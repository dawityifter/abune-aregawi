package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.LedgerEntry;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.repository.LedgerEntryRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ZelleService {

    private final ZelleMemoMatchRepository zelleMemoMatchRepository;
    private final MemberRepository memberRepository;
    private final church.abunearegawi.backend.repository.TransactionRepository transactionRepository;
    private final church.abunearegawi.backend.repository.IncomeCategoryRepository incomeCategoryRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final ZelleGmailService zelleGmailService;

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findAll() {
        return zelleMemoMatchRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemberId(Long memberId) {
        return zelleMemoMatchRepository.findByMemberId(memberId);
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemo(String memo) {
        return zelleMemoMatchRepository.findByMemoContainingIgnoreCase(memo);
    }

    @Transactional(readOnly = true)
    public Optional<ZelleMemoMatch> findByMemberIdAndMemo(Long memberId, String memo) {
        return zelleMemoMatchRepository.findByMemberIdAndMemo(memberId, memo);
    }

    @Transactional
    public ZelleMemoMatch create(Long memberId, String firstName, String lastName, String memo) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        ZelleMemoMatch match = ZelleMemoMatch.builder()
                .member(member)
                .firstName(firstName)
                .lastName(lastName)
                .memo(memo)
                .build();

        return zelleMemoMatchRepository.save(match);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        zelleMemoMatchRepository.deleteById(id);
    }

    public java.util.Map<String, Object> previewGmail(int limit) throws Exception {
        return zelleGmailService.previewZelleFromGmail(limit);
    }

    /**
     * Create a single Zelle transaction from the simple create-transaction endpoint.
     * Returns a map with { id, data } on success or throws with details for 409 on duplicate.
     */
    @Transactional
    public Map<String, Object> createTransaction(String externalId, BigDecimal amount, LocalDate paymentDate,
            String note, Long memberId, String paymentType, Long collectedById) {

        // 1. Check uniqueness (insert-only semantics)
        if (externalId != null) {
            Optional<church.abunearegawi.backend.model.Transaction> existing = transactionRepository.findByExternalId(externalId);
            if (existing.isPresent()) {
                Map<String, Object> error = new java.util.LinkedHashMap<>();
                error.put("exists", true);
                error.put("id", existing.get().getId());
                throw new DuplicateTransactionException(
                        "Transaction already exists for this external_id", existing.get().getId());
            }
        }

        Member member = memberId != null ? memberRepository.findById(memberId).orElse(null) : null;
        Member collector = memberRepository.findById(collectedById)
                .orElseThrow(() -> new RuntimeException("Collector not found: " + collectedById));

        // Income Category logic
        String pType = paymentType != null ? paymentType : "donation";
        church.abunearegawi.backend.model.IncomeCategory incomeCategory = incomeCategoryRepository
                .findByPaymentTypeMapping(pType)
                .stream().findFirst().orElse(null);
        if (incomeCategory == null) {
            incomeCategory = incomeCategoryRepository.findByPaymentTypeMapping("donation")
                    .stream().findFirst().orElse(null);
        }

        church.abunearegawi.backend.model.Transaction.PaymentType ptEnum;
        try {
            ptEnum = church.abunearegawi.backend.model.Transaction.PaymentType.valueOf(pType);
        } catch (Exception e) {
            ptEnum = church.abunearegawi.backend.model.Transaction.PaymentType.donation;
        }

        church.abunearegawi.backend.model.Transaction tx = church.abunearegawi.backend.model.Transaction.builder()
                .member(member)
                .collector(collector)
                .paymentDate(paymentDate != null ? paymentDate : LocalDate.now())
                .amount(amount)
                .paymentType(ptEnum)
                .paymentMethod(church.abunearegawi.backend.model.Transaction.PaymentMethod.zelle)
                .status(church.abunearegawi.backend.model.Transaction.Status.succeeded)
                .note(note)
                .externalId(externalId)
                .incomeCategory(incomeCategory)
                .build();

        tx = transactionRepository.save(tx);

        // Create Ledger Entry
        String glCode = incomeCategory != null ? incomeCategory.getGlCode() : "INC999";
        LedgerEntry entry = LedgerEntry.builder()
                .transaction(tx)
                .entryDate(tx.getPaymentDate())
                .amount(tx.getAmount())
                .type(tx.getPaymentType().name())
                .category(glCode)
                .paymentMethod("zelle")
                .memo(glCode + " - Zelle payment" + (externalId != null ? " " + externalId : ""))
                .externalId(externalId)
                .sourceSystem("zelle")
                .member(member)
                .collector(collector)
                .build();
        ledgerEntryRepository.save(entry);

        // Learn memo→member mapping
        if (member != null && note != null && !note.isBlank()) {
            Optional<ZelleMemoMatch> existing = zelleMemoMatchRepository.findByMemoIgnoreCase(note);
            if (existing.isEmpty()) {
                ZelleMemoMatch match = ZelleMemoMatch.builder()
                        .member(member)
                        .firstName(member.getFirstName())
                        .lastName(member.getLastName())
                        .memo(note)
                        .build();
                zelleMemoMatchRepository.save(match);
            } else {
                ZelleMemoMatch match = existing.get();
                if (!match.getMember().getId().equals(member.getId())) {
                    match.setMember(member);
                    match.setFirstName(member.getFirstName());
                    match.setLastName(member.getLastName());
                    zelleMemoMatchRepository.save(match);
                }
            }
        }

        // Build response data
        Map<String, Object> txnData = new java.util.LinkedHashMap<>();
        txnData.put("id", tx.getId());
        txnData.put("member_id", tx.getMember() != null ? tx.getMember().getId() : null);
        txnData.put("collected_by", tx.getCollector().getId());
        txnData.put("payment_date", tx.getPaymentDate());
        txnData.put("amount", tx.getAmount());
        txnData.put("payment_type", tx.getPaymentType());
        txnData.put("payment_method", tx.getPaymentMethod());
        txnData.put("status", tx.getStatus());
        txnData.put("note", tx.getNote());
        txnData.put("external_id", tx.getExternalId());
        txnData.put("income_category_id", tx.getIncomeCategory() != null ? tx.getIncomeCategory().getId() : null);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("id", tx.getId());
        result.put("data", txnData);
        return result;
    }

    /**
     * Process a single transaction from batch - wraps createTransaction with per-item error handling.
     */
    @Transactional
    public Map<String, Object> processTransactionCreation(
            ZelleGmailService.ParsedZelle item, Long collectedById) {

        String externalId = item.getExternalId();
        BigDecimal amount = item.getAmount();
        LocalDate paymentDate = item.getPaymentDate();
        String note = item.getNotePreview();
        Long memberId = item.getMatchedMemberId();
        String paymentType = item.getPaymentType() != null ? item.getPaymentType() : "donation";

        return createTransaction(externalId, amount, paymentDate, note, memberId, paymentType, collectedById);
    }

    /** Custom exception for duplicate transactions (409). */
    public static class DuplicateTransactionException extends RuntimeException {
        private final Long existingId;
        public DuplicateTransactionException(String message, Long existingId) {
            super(message);
            this.existingId = existingId;
        }
        public Long getExistingId() { return existingId; }
    }

    /**
     * Batch create from raw map items (from controller). Returns per-item results matching Node.js format.
     */
    public List<Map<String, Object>> batchCreateFromMaps(List<Map<String, Object>> items, Long collectedById) {
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        for (Map<String, Object> item : items) {
            String externalId = (String) item.get("external_id");
            try {
                java.math.BigDecimal amount = item.get("amount") != null
                        ? new java.math.BigDecimal(item.get("amount").toString()) : null;
                LocalDate paymentDate = item.get("payment_date") != null
                        ? LocalDate.parse(item.get("payment_date").toString()) : null;
                String note = (String) item.get("note");
                Long memberId = item.get("member_id") != null ? ((Number) item.get("member_id")).longValue() : null;
                String paymentType = (String) item.get("payment_type");

                Map<String, Object> txnResult = createTransaction(
                        externalId, amount, paymentDate, note, memberId, paymentType, collectedById);

                Map<String, Object> resultItem = new java.util.LinkedHashMap<>();
                resultItem.put("success", true);
                resultItem.put("id", txnResult.get("id"));
                resultItem.put("data", txnResult.get("data"));
                resultItem.put("external_id", externalId);
                results.add(resultItem);
            } catch (DuplicateTransactionException e) {
                Map<String, Object> resultItem = new java.util.LinkedHashMap<>();
                resultItem.put("success", false);
                resultItem.put("message", e.getMessage());
                resultItem.put("id", e.getExistingId());
                resultItem.put("code", "EXISTS");
                resultItem.put("external_id", externalId);
                results.add(resultItem);
            } catch (Exception e) {
                Map<String, Object> resultItem = new java.util.LinkedHashMap<>();
                resultItem.put("success", false);
                resultItem.put("message", e.getMessage());
                resultItem.put("external_id", externalId);
                results.add(resultItem);
            }
        }
        return results;
    }
}
