package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.BankTransaction;
import church.abunearegawi.backend.repository.BankTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BankTransactionService {

    private final BankTransactionRepository bankTransactionRepository;
    private final church.abunearegawi.backend.repository.MemberRepository memberRepository;
    private final church.abunearegawi.backend.repository.TransactionRepository transactionRepository;
    private final church.abunearegawi.backend.repository.LedgerEntryRepository ledgerEntryRepository;
    private final MemberPaymentService memberPaymentService;

    @Transactional(readOnly = true)
    public Page<BankTransaction> findAll(BankTransaction.Status status, String type,
            LocalDate startDate, LocalDate endDate,
            String description, Pageable pageable) {
        return bankTransactionRepository.findWithFilters(status, type, startDate, endDate, description, pageable);
    }

    @Transactional(readOnly = true)
    public Optional<BankTransaction> findById(Integer id) {
        return bankTransactionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<BankTransaction> findByTransactionHash(String hash) {
        return bankTransactionRepository.findByTransactionHash(hash);
    }

    @Transactional
    public BankTransaction create(BankTransaction transaction) {
        // Check if transaction hash already exists
        if (transaction.getTransactionHash() != null) {
            Optional<BankTransaction> existing = bankTransactionRepository
                    .findByTransactionHash(transaction.getTransactionHash());
            if (existing.isPresent()) {
                throw new RuntimeException(
                        "Transaction with hash " + transaction.getTransactionHash() + " already exists");
            }
        }
        return bankTransactionRepository.save(transaction);
    }

    public java.math.BigDecimal getCurrentBalance() {
        return bankTransactionRepository.findTopByBalanceNotNullOrderByDateDescIdAsc()
                .map(anchor -> {
                    java.math.BigDecimal newerSum = bankTransactionRepository.sumAmountNewerThan(anchor.getDate(),
                            anchor.getId());
                    if (newerSum != null) {
                        return anchor.getBalance().add(newerSum);
                    }
                    return anchor.getBalance();
                })
                .orElse(null);
    }

    @Transactional
    public BankTransaction update(Integer id, BankTransaction transaction) {
        BankTransaction existing = bankTransactionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Bank transaction not found"));

        if (transaction.getStatus() != null)
            existing.setStatus(transaction.getStatus());
        if (transaction.getMember() != null)
            existing.setMember(transaction.getMember());
        if (transaction.getBalance() != null)
            existing.setBalance(transaction.getBalance());
        if (transaction.getRawData() != null)
            existing.setRawData(transaction.getRawData());

        return bankTransactionRepository.save(existing);
    }

    @Transactional
    public void delete(Integer id) {
        bankTransactionRepository.deleteById(id);
    }

    @Transactional
    public java.util.Map<String, Object> processUpload(org.springframework.web.multipart.MultipartFile file) {
        int imported = 0;
        int skipped = 0;

        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(file.getInputStream()))) {
            String line;
            // Skip header if present (Chase CSV usually has headers)
            // Header: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
            boolean firstLine = true;
            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    if (line.toLowerCase().startsWith("details")) {
                        firstLine = false;
                        continue;
                    }
                    firstLine = false;
                }

                if (line.trim().isEmpty())
                    continue;

                // Simple CSV parsing (handling quotes if necessary)
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);

                if (parts.length < 4)
                    continue; // Basic validation

                // Index 1: Posting Date (MM/DD/YYYY)
                String dateStr = parts[1].trim();
                LocalDate date = LocalDate.parse(dateStr, java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy"));

                // Index 2: Description (remove quotes)
                String description = parts[2].trim().replace("\"", "");

                // Index 3: Amount - Remove quotes and commas
                String amountStr = parts[3].trim().replace("\"", "").replace(",", "");
                java.math.BigDecimal amount = new java.math.BigDecimal(amountStr);

                // Index 5: Balance (Optional but important for current balance)
                java.math.BigDecimal balance = null;
                if (parts.length > 5 && !parts[5].trim().isEmpty()) {
                    try {
                        String balanceStr = parts[5].trim().replace("\"", "").replace(",", "");
                        balance = new java.math.BigDecimal(balanceStr);
                    } catch (Exception e) {
                        // Ignore parse error
                    }
                }

                // Index 6: Check Number (optional)
                String checkNumber = null;
                if (parts.length > 6 && !parts[6].trim().isEmpty()) {
                    checkNumber = parts[6].trim();
                }

                // Create a unique hash to prevent duplicates using SHA-256
                String hashInput = date.toString() + description + amount.toString();
                String hash;
                try {
                    java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                    byte[] encodedhash = digest.digest(hashInput.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    hash = java.util.HexFormat.of().formatHex(encodedhash);
                } catch (java.security.NoSuchAlgorithmException e) {
                    hash = String.valueOf(hashInput.hashCode());
                }

                Optional<BankTransaction> existing = bankTransactionRepository.findByTransactionHash(hash);
                if (existing.isPresent()) {
                    // unexpected null balance fix: if existing has null balance but we have one
                    // now, update it
                    BankTransaction existingTxn = existing.get();
                    if (existingTxn.getBalance() == null && balance != null) {
                        existingTxn.setBalance(balance);
                        if (existingTxn.getRawData() == null) {
                            // Store simplified RAW CSV data for debugging if not present
                            java.util.Map<String, Object> raw = new java.util.HashMap<>();
                            raw.put("line", line);
                            raw.put("csv_parts", java.util.Arrays.asList(parts));
                            existingTxn.setRawData(raw);
                        }
                        bankTransactionRepository.save(existingTxn);
                        imported++; // Count as imported/processed
                    } else {
                        skipped++;
                    }
                    continue;
                }

                BankTransaction txn = new BankTransaction();
                txn.setDate(date);
                txn.setDescription(description);
                txn.setAmount(amount);
                txn.setBalance(balance);
                txn.setTransactionHash(hash);
                txn.setStatus(BankTransaction.Status.PENDING);
                txn.setType(determineType(description));
                txn.setCheckNumber(checkNumber);

                // Store simplified RAW CSV data for debugging
                java.util.Map<String, Object> raw = new java.util.HashMap<>();
                raw.put("line", line);
                raw.put("csv_parts", java.util.Arrays.asList(parts));
                txn.setRawData(raw);

                // Extract payer name from description (simple logic for Zelle)
                if (description.toUpperCase().contains("ZELLE")) {
                    // Attempt to extract name... usually "ZELLE TRANSFER FROM FIRST LAST"
                    String name = extractNameFromZelle(description);
                    txn.setPayerName(name);

                    // Attempt auto-match
                    Optional<church.abunearegawi.backend.model.Member> member = findMemberByName(name);
                    if (member.isPresent()) {
                        txn.setSuggestedMatchMember(member.get());
                    }
                }

                bankTransactionRepository.save(txn);
                imported++;
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to process CSV file: " + e.getMessage(), e);
        }

        return java.util.Map.of("imported", imported, "skipped", skipped);
    }

    @Transactional
    public void reconcile(Integer txId, Long memberId, String type, String manualDonorName, String manualDonorType,
            Integer existingId, church.abunearegawi.backend.model.Member collector) {
        BankTransaction bankTxn = bankTransactionRepository.findById(txId)
                .orElseThrow(() -> new RuntimeException("Bank transaction not found"));

        if (bankTxn.getStatus() == BankTransaction.Status.MATCHED) {
            throw new RuntimeException("Transaction already reconciled");
        }

        // Duplicate check on external ID if creating new
        // Use transactionHash as unique identifier from bank
        if (existingId == null && bankTxn.getTransactionHash() != null) {
            // Check if any transaction exists with this external ID (we prepend BANK-TXN-)
            String potentialExtId = "BANK-TXN-" + bankTxn.getId();
            if (transactionRepository.existsByExternalId(potentialExtId)) {
                throw new RuntimeException("Transaction with this External ID already exists");
            }
        }

        church.abunearegawi.backend.model.Member member = null;
        if (memberId != null) {
            member = memberRepository.findById(memberId).orElse(null);
        }

        church.abunearegawi.backend.model.Transaction.PaymentType paymentType = church.abunearegawi.backend.model.Transaction.PaymentType.other;
        try {
            paymentType = church.abunearegawi.backend.model.Transaction.PaymentType.valueOf(type);
        } catch (Exception e) {
            // default to other
        }

        // 1. Create or Update Transaction
        church.abunearegawi.backend.model.Transaction newTxn;
        if (existingId != null) {
            newTxn = transactionRepository.findById(existingId.longValue())
                    .orElseThrow(() -> new RuntimeException("Existing transaction not found"));
        } else {
            newTxn = new church.abunearegawi.backend.model.Transaction();
        }

        // Use a generated external ID based on BankTransaction ID to be consistent
        newTxn.setExternalId("BANK-TXN-" + bankTxn.getId());

        newTxn.setAmount(bankTxn.getAmount());
        newTxn.setPaymentDate(bankTxn.getDate()); // Match bank date
        newTxn.setPaymentType(paymentType);
        newTxn.setMember(member); // Null if manual donor
        newTxn.setPaymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.zelle); // We know it's
                                                                                                    // Zelle/Bank

        // Construct Note/Memo
        // Format: "Reconciled from Bank: [IncomeType] from [DonorName] [Note] [Memo]"
        String donorName = manualDonorName;
        if (donorName == null && member != null) {
            donorName = member.getFirstName() + " " + member.getLastName();
        }
        if (donorName == null)
            donorName = "Unknown";

        // Add Manual Donor Type prefix if MANUAL (no member)
        String prefix = "";
        if (member == null && manualDonorType != null) {
            prefix = "[" + manualDonorType + "] ";
        } else if (member == null) {
            prefix = "[Manual Donor] ";
        }

        // If member exists, we don't need a prefix typically, or maybe [Member] but
        // usually
        // omitted.

        String note = String.format("Reconciled from Bank: %s%s from %s %s",
                prefix,
                type,
                donorName,
                (bankTxn.getDescription() != null ? bankTxn.getDescription() : ""));
        if (note.length() > 255) {
            note = note.substring(0, 255);
        }
        newTxn.setNote(note);
        newTxn.setStatus(church.abunearegawi.backend.model.Transaction.Status.succeeded);

        // Collector (Requester)
        if (collector != null) {
            newTxn.setCollector(collector);
        } else {
            // CRITICAL: Cannot proceed without collector.
            throw new RuntimeException("Collector (authenticated user) is required for reconciliation");
        }

        church.abunearegawi.backend.model.Transaction savedTxn = transactionRepository.save(newTxn);

        // Resolve GL Code (Fund/Category)
        String glCode = "4000"; // General
        switch (newTxn.getPaymentType()) {
            case tithe:
                glCode = "4001";
                break;
            case membership_due:
                glCode = "4002";
                break;
            case building_fund:
                glCode = "4003";
                break;
            case offering:
                glCode = "4200";
                break;
            case tigray_hunger_fundraiser:
                glCode = "4004";
                break;
            case donation:
                glCode = "4005";
                break;
            case event:
                glCode = "4006";
                break;
            case religious_item_sales:
                glCode = "4007";
                break;
            case vow:
                glCode = "4008";
                break;
            case other:
            default:
                glCode = "4000";
        }

        // 2. Create Ledger Entry
        church.abunearegawi.backend.model.LedgerEntry entry = new church.abunearegawi.backend.model.LedgerEntry();
        entry.setTransaction(savedTxn);
        entry.setEntryDate(savedTxn.getPaymentDate());
        entry.setAmount(savedTxn.getAmount()); // Positive for Income
        entry.setType("income");
        entry.setCategory(glCode); // Using Category for GL Code
        // entry.setGlCode(glCode); // Field does not exist

        entry.setMemo("Bank Imp: " + savedTxn.getNote());
        // entry.setStatus(...) // Field does not exist

        entry.setSourceSystem("bank_import");
        if (member != null) {
            entry.setMember(member);
        }

        // Populate collector in Ledger too if available
        if (collector != null) {
            entry.setCollector(collector);
        }

        ledgerEntryRepository.save(entry);

        // 3. Update Bank Transaction Status
        bankTxn.setStatus(BankTransaction.Status.MATCHED);
        bankTransactionRepository.save(bankTxn);

        // 4. Update Member Payment Stats (for Dues Grid)
        if (member != null && newTxn
                .getPaymentType() == church.abunearegawi.backend.model.Transaction.PaymentType.membership_due) {
            try {
                memberPaymentService.recalculateMemberPayment(member.getId(), newTxn.getPaymentDate().getYear());
            } catch (Exception e) {
                // Log but don't fail transaction
                System.err.println("Failed to update member payment stats: " + e.getMessage());
            }
        }
    }

    @Transactional
    public void batchReconcile(java.util.List<java.util.Map<String, Object>> items,
            church.abunearegawi.backend.model.Member collector) {
        for (java.util.Map<String, Object> item : items) {
            try {
                Integer txId = (Integer) item.get("transaction_id");
                Long memberId = item.get("member_id") != null ? ((Number) item.get("member_id")).longValue() : null;
                String type = (String) item.get("payment_type");
                String manualDonor = (String) item.get("manual_donor_name");
                String manualDonorType = (String) item.get("manual_donor_type");

                // existing_transaction_id might be null
                Integer existingId = item.get("existing_transaction_id") != null
                        ? (Integer) item.get("existing_transaction_id")
                        : null;

                reconcile(txId, memberId, type, manualDonor, manualDonorType, existingId, collector);
            } catch (Exception e) {
                System.err.println("Failed to reconcile item in batch: " + item + " Error: " + e.getMessage());
                // Continue with others? Or fail generic?
                // Ideally partial success is better for user experience in batch ops?
                // But standard is strict. Let's strictly fail if one fails?
                // User asked for fix.
                throw new RuntimeException("Batch processing failed at item: " + item, e);
            }
        }
    }

    // Helper methods
    private String determineType(String description) {
        String upper = description.toUpperCase();
        if (upper.contains("ZELLE"))
            return "ZELLE";
        if (upper.contains("CHECK"))
            return "CHECK";
        return "OTHER";
    }

    private String extractNameFromZelle(String description) {
        // Very basic extraction logic
        // "ZELLE TRANSFER FROM FIRST LAST" -> "FIRST LAST"
        // Adjust based on real data patterns
        return "Unknown";
    }

    private Optional<church.abunearegawi.backend.model.Member> findMemberByName(String name) {
        // Implement search
        return Optional.empty();
    }
}
