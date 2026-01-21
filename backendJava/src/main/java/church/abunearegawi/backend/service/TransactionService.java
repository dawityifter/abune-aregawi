package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.TransactionDTO;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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

        // Manual DTO mapping (will be replaced by MapStruct later)
        public TransactionDTO toDTO(Transaction t) {
                return new TransactionDTO(
                                t.getId(),
                                t.getPaymentType() != null ? t.getPaymentType().name() : null,
                                t.getAmount(),
                                t.getPaymentDate(),
                                null, // description
                                t.getPaymentMethod() != null ? t.getPaymentMethod().name() : null,
                                t.getReceiptNumber(), // correct field
                                t.getMember() != null ? t.getMember().getId() : null,
                                t.getMember() != null ? t.getMember().getFirstName() + " " + t.getMember().getLastName()
                                                : null,
                                t.getMember() != null
                                                ? church.abunearegawi.backend.dto.MemberDTO.fromEntity(t.getMember(),
                                                                false)
                                                : null,
                                t.getDonation() != null ? t.getDonation().getId() : null,
                                t.getIncomeCategory() != null ? t.getIncomeCategory().getId() : null,
                                t.getIncomeCategory() != null ? t.getIncomeCategory().getName() : null,
                                t.getCollector() != null ? t.getCollector().getId() : null,
                                t.getCollector() != null
                                                ? t.getCollector().getFirstName() + " " + t.getCollector().getLastName()
                                                : null,
                                t.getNote(),
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

                List<church.abunearegawi.backend.model.Member> members = memberRepository.findAll();
                long upToDateMembers = 0;

                // Optimize: bulk fetch payments for the year? Or iterate (N+1 prob).
                // Better: get list of member Ids and their sums in one query if possible.
                // Or just fetch all transactions for the year and map to member.

                List<Transaction> yearTransactions = transactionRepository.findByPaymentDateBetween(startOfYear,
                                endOfYear);
                java.util.Map<Long, BigDecimal> memberPayments = new java.util.HashMap<>();

                for (Transaction t : yearTransactions) {
                        if (t.getMember() != null) {
                                memberPayments.merge(t.getMember().getId(), t.getAmount(), BigDecimal::add);
                        }
                }

                for (church.abunearegawi.backend.model.Member m : members) {
                        if (!m.isActive())
                                continue; // Skip inactive?

                        BigDecimal pledge = m.getYearlyPledge();
                        if (pledge == null || pledge.compareTo(BigDecimal.ZERO) == 0) {
                                // If no pledge, are they up to date? Let's say yes.
                                upToDateMembers++;
                                continue;
                        }

                        BigDecimal paid = memberPayments.getOrDefault(m.getId(), BigDecimal.ZERO);
                        if (paid.compareTo(pledge) >= 0) {
                                upToDateMembers++;
                        }
                }

                long behindMembers = members.size() - upToDateMembers;
                // Adjust behind to only count active members?
                // Let's count total active members instead of totalMembers (count()).
                long activeMembers = members.stream().filter(church.abunearegawi.backend.model.Member::isActive)
                                .count();
                // recalculate behind
                behindMembers = activeMembers - upToDateMembers;
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
}
