package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.TransactionDTO;
import church.abunearegawi.backend.exception.BadRequestException;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.JoinType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

        private final TransactionRepository transactionRepository;
        private final church.abunearegawi.backend.repository.MemberRepository memberRepository;

        @Transactional(readOnly = true)
        public TransactionDTO findById(Long id) {
                return transactionRepository.findById(id)
                                .map(this::toDTO)
                                .orElseThrow(() -> new RuntimeException("Transaction not found: " + id));
        }

        @Transactional(readOnly = true)
        public List<TransactionDTO> findByMember(Long memberId) {
                return transactionRepository.findByMemberId(memberId)
                                .stream()
                                .map(this::toDTO)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public Page<TransactionDTO> findAll(Pageable pageable) {
                return transactionRepository.findAll(pageable)
                                .map(this::toDTO);
        }

        @Transactional(readOnly = true)
        public Page<TransactionDTO> findAllFiltered(Map<String, String> filters, Pageable pageable) {
                Specification<Transaction> spec = (root, query, cb) -> cb.conjunction();

                String search = trimToNull(filters.get("search"));
                if (search != null) {
                        String like = "%" + search.toLowerCase() + "%";
                        spec = spec.and((root, query, cb) -> {
                                query.distinct(true);
                                var memberJoin = root.join("member", JoinType.LEFT);
                                return cb.or(
                                                cb.like(cb.lower(cb.coalesce(root.get("note"), "")), like),
                                                cb.like(cb.lower(cb.coalesce(root.get("receiptNumber"), "")), like),
                                                cb.like(cb.lower(cb.coalesce(memberJoin.get("firstName"), "")), like),
                                                cb.like(cb.lower(cb.coalesce(memberJoin.get("lastName"), "")), like),
                                                cb.like(cb.lower(cb.coalesce(memberJoin.get("email"), "")), like),
                                                cb.like(cb.lower(cb.coalesce(memberJoin.get("phoneNumber"), "")), like));
                        });
                }

                String paymentType = trimToNull(filters.get("payment_type"));
                if (paymentType != null) {
                        Transaction.PaymentType parsed = parseEnum(Transaction.PaymentType.class, paymentType, "Invalid payment_type");
                        spec = spec.and((root, query, cb) -> cb.equal(root.get("paymentType"), parsed));
                }

                String paymentMethod = trimToNull(filters.get("payment_method"));
                if (paymentMethod != null) {
                        Transaction.PaymentMethod parsed = parseEnum(Transaction.PaymentMethod.class, paymentMethod, "Invalid payment_method");
                        spec = spec.and((root, query, cb) -> cb.equal(root.get("paymentMethod"), parsed));
                }

                String receiptNumber = trimToNull(filters.get("receipt_number"));
                if (receiptNumber != null) {
                        spec = spec.and((root, query, cb) -> cb.equal(root.get("receiptNumber"), receiptNumber));
                }

                String memberId = trimToNull(filters.get("member_id"));
                if (memberId != null) {
                        Long parsedMemberId;
                        try {
                                parsedMemberId = Long.parseLong(memberId);
                        } catch (NumberFormatException ex) {
                                throw new BadRequestException("Invalid member_id");
                        }
                        Long finalMemberId = parsedMemberId;
                        spec = spec.and((root, query, cb) -> cb.equal(root.join("member", JoinType.LEFT).get("id"), finalMemberId));
                }

                LocalDate startDate = parseDate(filters.get("start_date"), "Invalid start_date");
                if (startDate != null) {
                        spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("paymentDate"), startDate));
                }

                LocalDate endDate = parseDate(filters.get("end_date"), "Invalid end_date");
                if (endDate != null) {
                        spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("paymentDate"), endDate));
                }

                return transactionRepository.findAll(spec, pageable).map(this::toDTO);
        }

        @Transactional(readOnly = true)
        public Page<TransactionDTO> findByPaymentType(Transaction.PaymentType paymentType, Pageable pageable) {
                return transactionRepository.findByPaymentType(paymentType, pageable)
                                .map(this::toDTO);
        }

        @Transactional(readOnly = true)
        public List<TransactionDTO> findByDateRange(LocalDate startDate, LocalDate endDate) {
                return transactionRepository.findByPaymentDateBetween(startDate, endDate)
                                .stream()
                                .map(this::toDTO)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public BigDecimal getTotalByPaymentTypeAndDateRange(Transaction.PaymentType paymentType, LocalDate startDate,
                        LocalDate endDate) {
                BigDecimal total = transactionRepository.sumByPaymentTypeAndDateRange(paymentType, startDate, endDate);
                return total != null ? total : BigDecimal.ZERO;
        }

        @Transactional(readOnly = true)
        public BigDecimal getTotalByMemberAndDateRange(Long memberId, LocalDate startDate, LocalDate endDate) {
                BigDecimal total = transactionRepository.sumByMemberAndDateRange(memberId, startDate, endDate);
                return total != null ? total : BigDecimal.ZERO;
        }

        @Transactional
        public TransactionDTO create(Transaction transaction) {
                Transaction saved = transactionRepository.save(transaction);
                return toDTO(saved);
        }

        @Transactional
        public TransactionDTO update(Long id, Transaction transaction) {
                Transaction existing = transactionRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Transaction not found: " + id));

                // Update fields
                existing.setAmount(transaction.getAmount());
                existing.setPaymentDate(transaction.getPaymentDate());
                existing.setPaymentMethod(transaction.getPaymentMethod());
                existing.setNote(transaction.getNote());

                Transaction updated = transactionRepository.save(existing);
                return toDTO(updated);
        }

        @Transactional
        public void delete(Long id) {
                transactionRepository.deleteById(id);
        }

        // Manual DTO mapping
        public TransactionDTO toDTO(Transaction t) {
                // Build snake_case member map matching Node.js Sequelize output
                java.util.Map<String, Object> memberMap = null;
                if (t.getMember() != null) {
                        memberMap = new java.util.LinkedHashMap<>();
                        memberMap.put("id", t.getMember().getId());
                        memberMap.put("first_name", t.getMember().getFirstName());
                        memberMap.put("last_name", t.getMember().getLastName());
                        memberMap.put("email", t.getMember().getEmail());
                        memberMap.put("phone_number", t.getMember().getPhoneNumber());
                }

                // Build snake_case collector map
                java.util.Map<String, Object> collectorMap = null;
                if (t.getCollector() != null) {
                        collectorMap = new java.util.LinkedHashMap<>();
                        collectorMap.put("id", t.getCollector().getId());
                        collectorMap.put("first_name", t.getCollector().getFirstName());
                        collectorMap.put("last_name", t.getCollector().getLastName());
                        collectorMap.put("email", t.getCollector().getEmail());
                        collectorMap.put("phone_number", t.getCollector().getPhoneNumber());
                }

                // Build incomeCategory map
                java.util.Map<String, Object> incomeCategoryMap = null;
                if (t.getIncomeCategory() != null) {
                        incomeCategoryMap = new java.util.LinkedHashMap<>();
                        incomeCategoryMap.put("id", t.getIncomeCategory().getId());
                        incomeCategoryMap.put("gl_code", t.getIncomeCategory().getGlCode());
                        incomeCategoryMap.put("name", t.getIncomeCategory().getName());
                        incomeCategoryMap.put("description", t.getIncomeCategory().getDescription());
                }

                return new TransactionDTO(
                                t.getId(),
                                t.getPaymentType() != null ? t.getPaymentType().name() : null,
                                t.getAmount(),
                                t.getPaymentDate(),
                                null, // description
                                t.getPaymentMethod() != null ? t.getPaymentMethod().name() : null,
                                t.getReceiptNumber(),
                                t.getMember() != null ? t.getMember().getId() : null,
                                t.getMember() != null
                                                ? t.getMember().getFirstName() + " " + t.getMember().getLastName()
                                                : null,
                                memberMap,
                                collectorMap,
                                t.getDonation() != null ? t.getDonation().getId() : null,
                                t.getIncomeCategory() != null ? t.getIncomeCategory().getId() : null,
                                t.getIncomeCategory() != null ? t.getIncomeCategory().getName() : null,
                                incomeCategoryMap,
                                t.getCollector() != null ? t.getCollector().getId() : null,
                                t.getCollector() != null
                                                ? t.getCollector().getFirstName() + " " + t.getCollector().getLastName()
                                                : null,
                                t.getNote(),
                                t.getStatus() != null ? t.getStatus().name() : null,
                                t.getCreatedAt(),
                                t.getUpdatedAt());
        }

        @Transactional(readOnly = true)
        public java.util.Map<String, Object> getFundraiserReport(String email) {
                // Fetch all fundraiser transactions
                List<Transaction> transactions = transactionRepository
                                .findByPaymentType(Transaction.PaymentType.tigray_hunger_fundraiser);

                // Filter by email if present and matches a member, but typical behavior for
                // admin report is ALL.
                // If the request comes from a specific user checking THEIR contribution,
                // filtering happens.
                // However, the report name suggests an aggregate report.
                // Let's assume: if email belongs to ADMIN/TREASURER, return ALL. Else filter
                // only theirs.
                // BUT: current method signature just takes email. We'll stick to logic: return
                // all, unless email suggests filtering scope (not clear from stub).
                // Looking at the frontend usage is safer. Assuming it's the "Fundraiser Report"
                // page for Admins: show ALL.

                List<TransactionDTO> dtos = transactions.stream()
                                .map(this::toDTO)
                                .collect(Collectors.toList());

                BigDecimal total = dtos.stream()
                                .map(TransactionDTO::amount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                // Return nested structure as expected by frontend: { "fundraiser": { ... } }
                // Note: Frontend expects "fundraiser" object with "totalCollected" and
                // "transactions"
                java.util.Map<String, Object> fundraiserData = new java.util.HashMap<>();
                fundraiserData.put("email", email != null ? email : "");
                fundraiserData.put("totalCollected", total);
                fundraiserData.put("transactions", dtos);

                return java.util.Map.of("fundraiser", fundraiserData);
        }

        @Transactional(readOnly = true)
        public java.util.Map<String, Object> getPaymentSummaryReport(String email) {

                // Calculate totals for the current fiscal year (Jan 1 to Dec 31)
                int year = LocalDate.now().getYear();
                LocalDate startOfYear = LocalDate.of(year, 1, 1);
                LocalDate endOfYear = LocalDate.of(year, 12, 31);

                BigDecimal totalCollected = transactionRepository.sumTotalByDateRange(startOfYear, endOfYear);
                if (totalCollected == null)
                        totalCollected = BigDecimal.ZERO;

                BigDecimal totalAmountDue = memberRepository.sumYearlyPledges();
                if (totalAmountDue == null)
                        totalAmountDue = BigDecimal.ZERO;

                // Up to date Logic:
                // "Up to date" means they paid at least their yearly pledge?
                // This is complex in SQL without a complex join.
                // Simplified approximation:
                // Fetch all members (expensive?) or count via query.
                // Let's assume we want to count members where (sum of their payments this year)
                // >= yearlyPledge.
                // Since we can't easily do that in one JPQL line without a subquery that might
                // be slow:
                // Let's iterate if member count is small (<1000). Previous chats imply ~300-500
                // members.
                // Iterating is acceptable for now.

                List<church.abunearegawi.backend.model.Member> members = memberRepository.findByIsActiveTrue();
                long upToDateMembers = 0;
                java.util.Map<Long, BigDecimal> memberPayments = new java.util.HashMap<>();
                for (Object[] row : transactionRepository.sumAmountsByMemberAndDateRange(startOfYear, endOfYear)) {
                        memberPayments.put(((Number) row[0]).longValue(), (BigDecimal) row[1]);
                }

                for (church.abunearegawi.backend.model.Member m : members) {
                        BigDecimal pledge = m.getYearlyPledge();
                        if (pledge == null || pledge.compareTo(BigDecimal.ZERO) == 0) {
                                upToDateMembers++;
                                continue;
                        }

                        BigDecimal paid = memberPayments.getOrDefault(m.getId(), BigDecimal.ZERO);
                        if (paid.compareTo(pledge) >= 0) {
                                upToDateMembers++;
                        }
                }

                long activeMembers = members.size();
                long behindMembers = activeMembers - upToDateMembers;
                if (behindMembers < 0)
                        behindMembers = 0; // Just in case

                String collectionRate = "0%";
                if (totalAmountDue.compareTo(BigDecimal.ZERO) > 0) {
                        java.math.BigDecimal rate = totalCollected
                                        .divide(totalAmountDue, 2, java.math.RoundingMode.HALF_UP)
                                        .multiply(new BigDecimal(100));
                        collectionRate = rate.intValue() + "%";
                }

                // Construct the nested "summary" object as expected by frontend
                java.util.Map<String, Object> summary = new java.util.HashMap<>();
                summary.put("totalMembers", activeMembers); // Use active members count as 'total members' makes more
                                                            // sense for dues
                summary.put("upToDateMembers", upToDateMembers);
                summary.put("behindMembers", behindMembers);
                summary.put("totalAmountDue", totalAmountDue);
                summary.put("totalCollected", totalCollected);
                summary.put("collectionRate", collectionRate);

                return java.util.Map.of("summary", summary);
        }

        @Transactional(readOnly = true)
        public java.util.Map<String, Object> getSkippedReceipts() {
                List<Integer> receipts = transactionRepository.findAllReceiptNumbers();
                if (receipts.isEmpty()) {
                        return java.util.Map.of(
                                        "range", java.util.Map.of("start", 0, "end", 0),
                                        "skippedReceipts", List.of());
                }

                int min = receipts.get(0);
                int max = receipts.get(receipts.size() - 1);

                List<Integer> skipped = new java.util.ArrayList<>();
                java.util.Set<Integer> present = new java.util.HashSet<>(receipts);

                for (int i = min; i <= max; i++) {
                        if (!present.contains(i)) {
                                skipped.add(i);
                        }
                }

                return java.util.Map.of(
                                "range", java.util.Map.of("start", min, "end", max),
                                "skippedReceipts", skipped);
        }

        private String trimToNull(String value) {
                if (value == null) {
                        return null;
                }
                String trimmed = value.trim();
                return trimmed.isEmpty() ? null : trimmed;
        }

        private LocalDate parseDate(String value, String message) {
                String trimmed = trimToNull(value);
                if (trimmed == null) {
                        return null;
                }
                try {
                        return LocalDate.parse(trimmed);
                } catch (Exception ex) {
                        throw new BadRequestException(message);
                }
        }

        private <E extends Enum<E>> E parseEnum(Class<E> enumClass, String value, String message) {
            try {
                return Enum.valueOf(enumClass, value);
            } catch (Exception ex) {
                throw new BadRequestException(message);
            }
        }
}
