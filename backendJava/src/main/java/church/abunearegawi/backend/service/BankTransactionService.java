package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.BankTransaction;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.repository.BankTransactionRepository;
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository;
import church.abunearegawi.backend.repository.IncomeCategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BankTransactionService {

    private final BankTransactionRepository bankTransactionRepository;
    private final church.abunearegawi.backend.repository.MemberRepository memberRepository;
    private final church.abunearegawi.backend.repository.TransactionRepository transactionRepository;
    private final church.abunearegawi.backend.repository.LedgerEntryRepository ledgerEntryRepository;
    private final MemberPaymentService memberPaymentService;
    private final ZelleMemoMatchRepository zelleMemoMatchRepository;
    private final IncomeCategoryRepository incomeCategoryRepository;

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
        java.util.List<String> errors = new java.util.ArrayList<>();

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

                // Extract payer name from description
                String extractedName = extractNameFromDescription(description);
                if (extractedName != null && !extractedName.isBlank()) {
                    txn.setPayerName(extractedName);
                }

                bankTransactionRepository.save(txn);
                imported++;
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to process CSV file: " + e.getMessage(), e);
        }

        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("errors", errors);
        return result;
    }

    @Transactional
    public java.util.Map<String, Object> reconcile(Integer txId, Long memberId, String type, String action,
            String manualDonorName, String manualDonorType,
            Integer existingId, Integer forYear, church.abunearegawi.backend.model.Member collector) {
        BankTransaction bankTxn = bankTransactionRepository.findById(txId)
                .orElseThrow(() -> new RuntimeException("Bank transaction not found"));

        if (bankTxn.getStatus() == BankTransaction.Status.MATCHED || bankTxn.getStatus() == BankTransaction.Status.IGNORED) {
            throw new RuntimeException("Transaction already processed");
        }

        // Handle IGNORE action
        if ("IGNORE".equalsIgnoreCase(action)) {
            bankTxn.setStatus(BankTransaction.Status.IGNORED);
            bankTransactionRepository.save(bankTxn);
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("message", "Transaction ignored");
            return result;
        }

        // Default: MATCH
        if (memberId == null && existingId == null) {
            throw new RuntimeException("Member ID or Existing Transaction ID required for matching");
        }

        // Duplicate check on external ID if creating new
        if (existingId == null && bankTxn.getTransactionHash() != null) {
            String potentialExtId = bankTxn.getTransactionHash();
            if (transactionRepository.existsByExternalId(potentialExtId)) {
                throw new RuntimeException("Transaction with this External ID already exists");
            }
        }

        church.abunearegawi.backend.model.Member member = null;
        if (memberId != null) {
            member = memberRepository.findById(memberId).orElse(null);
        }

        church.abunearegawi.backend.model.Transaction.PaymentType paymentType = church.abunearegawi.backend.model.Transaction.PaymentType.donation;
        if (type != null) {
            try {
                paymentType = church.abunearegawi.backend.model.Transaction.PaymentType.valueOf(type);
            } catch (Exception e) {
                // default to donation
            }
        }

        // 1. Create or Link Transaction
        church.abunearegawi.backend.model.Transaction newTxn;
        if (existingId != null) {
            newTxn = transactionRepository.findById(existingId.longValue())
                    .orElseThrow(() -> new RuntimeException("Existing transaction not found"));
            newTxn.setExternalId(bankTxn.getTransactionHash());
            if (newTxn.getStatus() != church.abunearegawi.backend.model.Transaction.Status.succeeded) {
                newTxn.setStatus(church.abunearegawi.backend.model.Transaction.Status.succeeded);
            }
        } else {
            newTxn = new church.abunearegawi.backend.model.Transaction();
            newTxn.setExternalId(bankTxn.getTransactionHash());
            newTxn.setAmount(bankTxn.getAmount());

            // Support for_year: override the payment date year
            LocalDate paymentDate = bankTxn.getDate();
            if (forYear != null) {
                paymentDate = paymentDate.withYear(forYear);
            }
            newTxn.setPaymentDate(paymentDate);

            newTxn.setPaymentType(paymentType);
            newTxn.setMember(member);

            // Determine payment method from bank txn type
            String bankType = bankTxn.getType() != null ? bankTxn.getType().toUpperCase() : "";
            if (bankType.contains("ZELLE")) {
                newTxn.setPaymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.zelle);
            } else if (bankType.contains("CHECK")) {
                newTxn.setPaymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.check);
            } else {
                newTxn.setPaymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.ach);
            }

            newTxn.setNote(bankTxn.getDescription());
            newTxn.setStatus(church.abunearegawi.backend.model.Transaction.Status.succeeded);

            if (collector == null) {
                throw new RuntimeException("Collector (authenticated user) is required for reconciliation");
            }
            newTxn.setCollector(collector);

            // Auto-assign income category
            church.abunearegawi.backend.model.IncomeCategory incomeCategory = incomeCategoryRepository
                    .findByPaymentTypeMapping(paymentType.name())
                    .stream().findFirst().orElse(null);
            newTxn.setIncomeCategory(incomeCategory);
        }

        church.abunearegawi.backend.model.Transaction savedTxn = transactionRepository.save(newTxn);

        // 2. Create/Sync Ledger Entry
        String glCode = "INC999";
        if (savedTxn.getIncomeCategory() != null) {
            glCode = savedTxn.getIncomeCategory().getGlCode();
        } else {
            // Lookup by payment type
            church.abunearegawi.backend.model.IncomeCategory cat = incomeCategoryRepository
                    .findByPaymentTypeMapping(savedTxn.getPaymentType().name())
                    .stream().findFirst().orElse(null);
            if (cat != null) glCode = cat.getGlCode();
        }

        church.abunearegawi.backend.model.LedgerEntry entry = new church.abunearegawi.backend.model.LedgerEntry();
        entry.setTransaction(savedTxn);
        entry.setEntryDate(savedTxn.getPaymentDate());
        entry.setAmount(savedTxn.getAmount());
        entry.setType(savedTxn.getPaymentType().name());
        entry.setCategory(glCode);
        entry.setPaymentMethod(savedTxn.getPaymentMethod() != null ? savedTxn.getPaymentMethod().name() : null);
        entry.setMemo(glCode + " - Bank reconciliation match " + bankTxn.getTransactionHash());
        entry.setExternalId(bankTxn.getTransactionHash());
        entry.setSourceSystem("bank_import");
        if (member != null) entry.setMember(member);
        if (collector != null) entry.setCollector(collector);
        ledgerEntryRepository.save(entry);

        // 3. Update Bank Transaction Status
        bankTxn.setStatus(BankTransaction.Status.MATCHED);
        bankTxn.setMember(member);
        bankTransactionRepository.save(bankTxn);

        // 4. Learn memo→member mapping
        if (member != null && bankTxn.getDescription() != null) {
            String cleanMemo = sanitizeForMemoMatch(bankTxn.getDescription());
            if (cleanMemo != null && cleanMemo.length() > 2) {
                Optional<ZelleMemoMatch> existingMatch = zelleMemoMatchRepository.findByMemoIgnoreCase(cleanMemo);
                if (existingMatch.isEmpty()) {
                    ZelleMemoMatch match = ZelleMemoMatch.builder()
                            .member(member)
                            .firstName(member.getFirstName())
                            .lastName(member.getLastName())
                            .memo(cleanMemo)
                            .build();
                    zelleMemoMatchRepository.save(match);
                }
            }
        }

        // 5. Update Member Payment Stats (for Dues Grid)
        if (member != null && savedTxn.getPaymentType() == church.abunearegawi.backend.model.Transaction.PaymentType.membership_due) {
            try {
                memberPaymentService.recalculateMemberPayment(member.getId(), savedTxn.getPaymentDate().getYear());
            } catch (Exception e) {
                log.warn("Failed to update member payment stats: {}", e.getMessage());
            }
        }

        // 6. Build response matching Node.js: { txn, donation }
        java.util.Map<String, Object> txnMap = new java.util.LinkedHashMap<>();
        txnMap.put("id", bankTxn.getId());
        txnMap.put("transaction_hash", bankTxn.getTransactionHash());
        txnMap.put("date", bankTxn.getDate());
        txnMap.put("amount", bankTxn.getAmount());
        txnMap.put("status", bankTxn.getStatus());
        txnMap.put("member_id", member != null ? member.getId() : null);

        java.util.Map<String, Object> donationMap = new java.util.LinkedHashMap<>();
        donationMap.put("id", savedTxn.getId());
        donationMap.put("member_id", savedTxn.getMember() != null ? savedTxn.getMember().getId() : null);
        donationMap.put("amount", savedTxn.getAmount());
        donationMap.put("payment_date", savedTxn.getPaymentDate());
        donationMap.put("payment_type", savedTxn.getPaymentType());
        donationMap.put("payment_method", savedTxn.getPaymentMethod());
        donationMap.put("status", savedTxn.getStatus());
        donationMap.put("external_id", savedTxn.getExternalId());
        donationMap.put("income_category_id", savedTxn.getIncomeCategory() != null ? savedTxn.getIncomeCategory().getId() : null);

        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("txn", txnMap);
        result.put("donation", donationMap);
        return result;
    }

    @Transactional
    public java.util.Map<String, Object> batchReconcile(java.util.List<Number> transactionIds,
            Long memberId, String paymentType, Integer forYear,
            church.abunearegawi.backend.model.Member collector) {
        java.util.List<Integer> successIds = new java.util.ArrayList<>();
        java.util.List<java.util.Map<String, Object>> errors = new java.util.ArrayList<>();

        for (Number txIdNum : transactionIds) {
            Integer txId = txIdNum.intValue();
            try {
                reconcile(txId, memberId, paymentType, "MATCH", null, null, null, forYear, collector);
                successIds.add(txId);
            } catch (Exception e) {
                java.util.Map<String, Object> err = new java.util.LinkedHashMap<>();
                err.put("transaction_id", txId);
                err.put("message", e.getMessage());
                errors.add(err);
            }
        }

        int total = transactionIds.size();
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("message", String.format("Processed %d items. Success: %d, Errors: %d",
                total, successIds.size(), errors.size()));
        java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("success", successIds);
        data.put("errors", errors);
        result.putAll(data);
        return result;
    }

    /**
     * Enrich a list of bank transactions with suggested_match and potential_matches for PENDING items.
     */
    @Transactional(readOnly = true)
    public java.util.List<java.util.Map<String, Object>> enrichTransactions(java.util.List<BankTransaction> transactions) {
        java.util.List<java.util.Map<String, Object>> enriched = new java.util.ArrayList<>();
        for (BankTransaction txn : transactions) {
            java.util.Map<String, Object> txnMap = bankTransactionToMap(txn);
            if (txn.getStatus() == BankTransaction.Status.PENDING) {
                java.util.Map<String, Object> suggestion = suggestMatch(txn);
                if (suggestion != null) {
                    txnMap.put("suggested_match", suggestion);
                }
                java.util.List<java.util.Map<String, Object>> potentialMatches = findPotentialMatches(txn);
                if (potentialMatches != null && !potentialMatches.isEmpty()) {
                    txnMap.put("potential_matches", potentialMatches);
                }
            }
            enriched.add(txnMap);
        }
        return enriched;
    }

    private java.util.Map<String, Object> bankTransactionToMap(BankTransaction txn) {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("id", txn.getId());
        map.put("transaction_hash", txn.getTransactionHash());
        map.put("date", txn.getDate());
        map.put("amount", txn.getAmount());
        map.put("balance", txn.getBalance());
        map.put("description", txn.getDescription());
        map.put("type", txn.getType());
        map.put("status", txn.getStatus());
        map.put("payer_name", txn.getPayerName());
        map.put("external_ref_id", txn.getExternalRefId());
        map.put("check_number", txn.getCheckNumber());
        map.put("member_id", txn.getMember() != null ? txn.getMember().getId() : null);
        if (txn.getMember() != null) {
            java.util.Map<String, Object> memberMap = new java.util.LinkedHashMap<>();
            memberMap.put("id", txn.getMember().getId());
            memberMap.put("first_name", txn.getMember().getFirstName());
            memberMap.put("last_name", txn.getMember().getLastName());
            memberMap.put("phone_number", txn.getMember().getPhoneNumber());
            map.put("member", memberMap);
        }
        map.put("created_at", txn.getCreatedAt());
        map.put("updated_at", txn.getUpdatedAt());
        return map;
    }

    /**
     * Suggest a member match for a bank transaction.
     * Priority: 1. Learned memo match (ZelleMemoMatch), 2. Fuzzy name match on payer_name
     */
    public java.util.Map<String, Object> suggestMatch(BankTransaction txn) {
        // 1. Check ZelleMemoMatch table
        String description = txn.getDescription();
        if (description != null && !description.isBlank()) {
            String cleanDesc = sanitizeForMemoMatch(description);
            Optional<ZelleMemoMatch> memoMatch = zelleMemoMatchRepository.findByMemoIgnoreCase(cleanDesc);
            if (memoMatch.isPresent()) {
                ZelleMemoMatch match = memoMatch.get();
                java.util.Map<String, Object> suggestion = new java.util.LinkedHashMap<>();
                suggestion.put("type", "MEMO_MATCH");
                java.util.Map<String, Object> memberMap = new java.util.LinkedHashMap<>();
                memberMap.put("id", match.getMember().getId());
                memberMap.put("first_name", match.getFirstName());
                memberMap.put("last_name", match.getLastName());
                suggestion.put("member", memberMap);
                return suggestion;
            }
        }

        // 2. Fuzzy name match on payer_name
        String payerName = txn.getPayerName();
        if (payerName == null || payerName.isBlank()) {
            payerName = extractNameFromDescription(description);
        }
        if (payerName != null && !payerName.isBlank() && !"Unknown".equals(payerName)) {
            java.util.List<church.abunearegawi.backend.model.Member> candidates = memberRepository.searchMembers(payerName);
            if (!candidates.isEmpty()) {
                church.abunearegawi.backend.model.Member best = candidates.get(0);
                java.util.Map<String, Object> suggestion = new java.util.LinkedHashMap<>();
                suggestion.put("type", "FUZZY_NAME");
                java.util.Map<String, Object> memberMap = new java.util.LinkedHashMap<>();
                memberMap.put("id", best.getId());
                memberMap.put("first_name", best.getFirstName());
                memberMap.put("last_name", best.getLastName());
                suggestion.put("member", memberMap);
                return suggestion;
            }
        }

        return null;
    }

    /**
     * Find potential system transaction matches: same amount within +/-5 days.
     */
    public java.util.List<java.util.Map<String, Object>> findPotentialMatches(BankTransaction txn) {
        if (txn.getAmount() == null || txn.getDate() == null) return java.util.Collections.emptyList();

        java.math.BigDecimal absAmount = txn.getAmount().abs();
        LocalDate start = txn.getDate().minusDays(5);
        LocalDate end = txn.getDate().plusDays(5);

        java.util.List<church.abunearegawi.backend.model.Transaction> matches =
                transactionRepository.findByAmountAndDateRange(absAmount, start, end);

        java.util.List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        for (church.abunearegawi.backend.model.Transaction t : matches) {
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("amount", t.getAmount());
            m.put("payment_date", t.getPaymentDate());
            if (t.getMember() != null) {
                java.util.Map<String, Object> memberMap = new java.util.LinkedHashMap<>();
                memberMap.put("first_name", t.getMember().getFirstName());
                memberMap.put("last_name", t.getMember().getLastName());
                m.put("member", memberMap);
            }
            result.add(m);
        }
        return result;
    }

    private String sanitizeForMemoMatch(String input) {
        if (input == null) return null;
        String out = input;
        out = out.replaceAll("(?i)^Zelle payment from\\s+", "");
        out = out.replaceAll("\\s+\\d+$", "");
        out = out.replaceAll("(?i)^CHECK\\s+\\d+\\s+", "");
        out = out.replaceAll("(?i)ORIG CO NAME:", "");
        out = out.replaceAll("(?i)IND NAME:", "");
        out = out.replaceAll("\\d{1,2}/\\d{1,2}/\\d{2,4}", "");
        out = out.replaceAll("\\s+\\d{6,}$", "");
        out = out.trim();
        return out;
    }

    private String extractNameFromDescription(String description) {
        if (description == null) return null;
        String upper = description.toUpperCase();
        // Zelle: "Zelle payment from FIRST LAST 12345"
        if (upper.contains("ZELLE")) {
            String cleaned = description.replaceAll("(?i)^.*?Zelle\\s+(payment|transfer)\\s+from\\s+", "");
            cleaned = cleaned.replaceAll("\\s+\\d+$", "").trim();
            if (!cleaned.isBlank()) return cleaned;
        }
        // ACH: "IND NAME:LASTNAME,FIRSTNAME"
        if (upper.contains("IND NAME:")) {
            int idx = upper.indexOf("IND NAME:");
            String nameStr = description.substring(idx + 9).trim();
            nameStr = nameStr.replaceAll("\\s+.*$", ""); // Take first token
            if (nameStr.contains(",")) {
                String[] parts = nameStr.split(",", 2);
                return (parts.length > 1 ? parts[1].trim() : "") + " " + parts[0].trim();
            }
            return nameStr;
        }
        return null;
    }

    // Helper methods
    private String determineType(String description) {
        String upper = description.toUpperCase();
        if (upper.contains("ZELLE"))
            return "ZELLE";
        if (upper.contains("CHECK"))
            return "CHECK";
        if (upper.contains("ACH"))
            return "ACH";
        return "OTHER";
    }
}
