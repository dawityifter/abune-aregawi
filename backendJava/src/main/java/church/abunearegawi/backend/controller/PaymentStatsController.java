package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.BankTransaction;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.BankTransactionRepository;
import church.abunearegawi.backend.repository.LedgerEntryRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentStatsController {

    private final MemberRepository memberRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final BankTransactionRepository bankTransactionRepository;

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY', 'CHURCH_LEADERSHIP', 'BOOKKEEPER', 'AUDITOR', 'BUDGET_COMMITTEE', 'AR_TEAM')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPaymentStats() {
        int year = LocalDate.now().getYear();
        int currentMonth = LocalDate.now().getMonthValue();
        LocalDate startOfYear = LocalDate.of(year, 1, 1);
        LocalDate endOfYear = LocalDate.of(year, 12, 31);

        // 1. Total members
        long totalMembers = memberRepository.count();

        // 2. Contributing members (yearly_pledge > 0)
        List<Member> allMembers = memberRepository.findByIsActiveTrue();
        List<Member> contributingMembersList = allMembers.stream()
                .filter(m -> m.getYearlyPledge() != null && m.getYearlyPledge().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        long contributingMembers = contributingMembersList.size();

        // 3. Total membership collected from ledger entries type='membership_due'
        BigDecimal totalMembershipCollected = ledgerEntryRepository.sumByTypeAndDateRange("membership_due", startOfYear, endOfYear);
        if (totalMembershipCollected == null) totalMembershipCollected = BigDecimal.ZERO;

        // 4. Other payments (non-membership_due, non-expense)
        BigDecimal otherPayments = ledgerEntryRepository.sumByNotTypeAndDateRange("membership_due", startOfYear, endOfYear);
        if (otherPayments == null) otherPayments = BigDecimal.ZERO;
        // Subtract expenses from otherPayments since sumByNotType includes expenses
        BigDecimal totalExpenses = ledgerEntryRepository.sumByTypeAndDateRange("expense", startOfYear, endOfYear);
        if (totalExpenses == null) totalExpenses = BigDecimal.ZERO;
        otherPayments = otherPayments.subtract(totalExpenses);
        if (otherPayments.compareTo(BigDecimal.ZERO) < 0) otherPayments = BigDecimal.ZERO;

        // 5. Per-member paid totals for up-to-date vs behind calculation
        long upToDateMembers = 0;
        long behindMembers = 0;
        BigDecimal totalAmountDue = BigDecimal.ZERO;

        if (contributingMembers > 0) {
            List<Object[]> paidRows = ledgerEntryRepository.findMembershipDueSumsByMember("membership_due", startOfYear, endOfYear);
            Map<Long, BigDecimal> paidMap = new java.util.HashMap<>();
            for (Object[] row : paidRows) {
                Long memberId = ((Number) row[0]).longValue();
                BigDecimal paidAmount = (BigDecimal) row[1];
                paidMap.put(memberId, paidAmount);
            }

            for (Member m : contributingMembersList) {
                BigDecimal pledge = m.getYearlyPledge();
                BigDecimal expectedToDate = pledge.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(currentMonth));
                totalAmountDue = totalAmountDue.add(expectedToDate);

                BigDecimal paidToDate = paidMap.getOrDefault(m.getId(), BigDecimal.ZERO);
                // 1e-6 tolerance like Node.js
                if (paidToDate.add(new BigDecimal("0.000001")).compareTo(expectedToDate) >= 0) {
                    upToDateMembers++;
                } else {
                    behindMembers++;
                }
            }
        }

        // 6. Total collected = membership + other
        BigDecimal totalCollected = totalMembershipCollected.add(otherPayments);

        // 7. Net income
        BigDecimal netIncome = totalCollected.subtract(totalExpenses);

        // 8. Outstanding amount
        BigDecimal outstandingAmount = totalAmountDue.subtract(totalMembershipCollected).max(BigDecimal.ZERO);

        // 9. Collection rate
        double collectionRate = contributingMembers > 0
                ? BigDecimal.valueOf(upToDateMembers)
                    .divide(BigDecimal.valueOf(contributingMembers), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue()
                : 0.0;

        // 10. Current bank balance and last update
        BigDecimal currentBankBalance = BigDecimal.ZERO;
        String lastBankUpdate = null;
        Optional<BankTransaction> latestBankTxn = bankTransactionRepository.findTopByBalanceNotNullOrderByDateDescIdAsc();
        if (latestBankTxn.isPresent()) {
            BankTransaction bt = latestBankTxn.get();
            currentBankBalance = bt.getBalance();
            if (bt.getUpdatedAt() != null) {
                lastBankUpdate = bt.getUpdatedAt().toString();
            } else if (bt.getCreatedAt() != null) {
                lastBankUpdate = bt.getCreatedAt().toString();
            }
        }

        // Build response matching Node.js shape
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalMembers", totalMembers);
        stats.put("contributingMembers", contributingMembers);
        stats.put("upToDateMembers", upToDateMembers);
        stats.put("behindMembers", behindMembers);
        stats.put("totalAmountDue", totalAmountDue.setScale(2, RoundingMode.HALF_UP));
        stats.put("totalMembershipCollected", totalMembershipCollected.setScale(2, RoundingMode.HALF_UP));
        stats.put("otherPayments", otherPayments.setScale(2, RoundingMode.HALF_UP));
        stats.put("totalCollected", totalCollected.setScale(2, RoundingMode.HALF_UP));
        stats.put("totalExpenses", totalExpenses.setScale(2, RoundingMode.HALF_UP));
        stats.put("netIncome", netIncome.setScale(2, RoundingMode.HALF_UP));
        stats.put("outstandingAmount", outstandingAmount.setScale(2, RoundingMode.HALF_UP));
        stats.put("collectionRate", collectionRate);
        stats.put("currentBankBalance", currentBankBalance);
        stats.put("lastBankUpdate", lastBankUpdate);

        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
