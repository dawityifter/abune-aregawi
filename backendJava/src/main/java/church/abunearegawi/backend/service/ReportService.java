package church.abunearegawi.backend.service;

import church.abunearegawi.backend.repository.LedgerEntryRepository;
import church.abunearegawi.backend.repository.TransactionRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final TransactionRepository transactionRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getWeeklyReport(LocalDate date) {
        LocalDate startOfWeek = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate endOfWeek = startOfWeek.plusDays(6);

        // Fetch all transactions and expenses for the week
        java.util.List<church.abunearegawi.backend.model.Transaction> transactions = transactionRepository
                .findByPaymentDateBetween(startOfWeek, endOfWeek);
        org.springframework.data.domain.Page<church.abunearegawi.backend.model.LedgerEntry> potentialExpenses = ledgerEntryRepository
                .findExpenses(
                        null, startOfWeek, endOfWeek, null, null, org.springframework.data.domain.Pageable.unpaged());
        java.util.List<church.abunearegawi.backend.model.LedgerEntry> expenses = potentialExpenses.getContent();

        // Structure: byPaymentMethod: { cash: { income: [], expenses: [], net... },
        // check: ... }
        Map<String, Map<String, Object>> byPaymentMethod = new HashMap<>();

        // Group Income (Transactions)
        for (church.abunearegawi.backend.model.Transaction t : transactions) {
            String method = t.getPaymentMethod() != null ? t.getPaymentMethod().name().toLowerCase() : "other";
            byPaymentMethod.putIfAbsent(method, initializePaymentMethodMap());

            Map<String, Object> data = byPaymentMethod.get(method);
            @SuppressWarnings("unchecked")
            java.util.List<Object> incomeList = (java.util.List<Object>) data.get("income");

            // Map Entity to simple object matching frontend
            Map<String, Object> tMap = new HashMap<>();
            tMap.put("id", t.getId());
            tMap.put("type", t.getPaymentType());
            tMap.put("amount", t.getAmount());
            tMap.put("entry_date", t.getPaymentDate());
            tMap.put("member_name",
                    t.getMember() != null ? t.getMember().getFirstName() + " " + t.getMember().getLastName()
                            : "Anonymous");
            tMap.put("receipt_number", t.getReceiptNumber()); // Receipt/Check#
            tMap.put("memo", t.getNote());
            incomeList.add(tMap);

            BigDecimal currentTotal = (BigDecimal) data.get("totalIncome");
            data.put("totalIncome", currentTotal.add(t.getAmount()));
        }

        // Group Expenses (LedgerEntries)
        for (church.abunearegawi.backend.model.LedgerEntry le : expenses) {
            String method = le.getPaymentMethod() != null ? le.getPaymentMethod().toLowerCase() : "other";
            byPaymentMethod.putIfAbsent(method, initializePaymentMethodMap());

            Map<String, Object> data = byPaymentMethod.get(method);
            @SuppressWarnings("unchecked")
            java.util.List<Object> expenseList = (java.util.List<Object>) data.get("expenses");

            Map<String, Object> eMap = new HashMap<>();
            eMap.put("id", le.getId());
            eMap.put("type", "expense");
            eMap.put("category", le.getCategory());
            eMap.put("amount", le.getAmount());
            eMap.put("entry_date", le.getEntryDate());
            eMap.put("memo", le.getMemo());
            expenseList.add(eMap);

            BigDecimal currentTotal = (BigDecimal) data.get("totalExpenses");
            data.put("totalExpenses", currentTotal.add(le.getAmount()));
        }

        // Calculate Net for each method and Global Summary
        BigDecimal globalIncome = BigDecimal.ZERO;
        BigDecimal globalExpenses = BigDecimal.ZERO;
        int totalTx = 0;

        for (Map<String, Object> data : byPaymentMethod.values()) {
            BigDecimal inc = (BigDecimal) data.get("totalIncome");
            BigDecimal exp = (BigDecimal) data.get("totalExpenses");
            data.put("netToDeposit", inc.subtract(exp));

            globalIncome = globalIncome.add(inc);
            globalExpenses = globalExpenses.add(exp);

            // Count transactions
            java.util.List<?> iList = (java.util.List<?>) data.get("income");
            java.util.List<?> eList = (java.util.List<?>) data.get("expenses");
            totalTx += iList.size() + eList.size();
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalIncome", globalIncome);
        summary.put("totalExpenses", globalExpenses);
        summary.put("netTotal", globalIncome.subtract(globalExpenses));
        summary.put("totalTransactions", totalTx);
        summary.put("depositBreakdown", new HashMap<>()); // simplified

        Map<String, Object> result = new HashMap<>();
        result.put("weekStart", startOfWeek);
        result.put("weekEnd", endOfWeek);
        result.put("byPaymentMethod", byPaymentMethod);
        result.put("summary", summary);

        return result;
    }

    private Map<String, Object> initializePaymentMethodMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("income", new java.util.ArrayList<>());
        map.put("expenses", new java.util.ArrayList<>());
        map.put("totalIncome", BigDecimal.ZERO);
        map.put("totalExpenses", BigDecimal.ZERO);
        map.put("netToDeposit", BigDecimal.ZERO);
        return map;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        // Simple member stats for potential reuse
        long totalMembers = memberRepository.count();
        long totalHouseholds = memberRepository.findAll().stream()
                .filter(m -> m.getFamilyHead() == null)
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalMembers", totalMembers);
        stats.put("totalHouseholds", totalHouseholds);

        return stats;
    }

    @Transactional(readOnly = true)
    public church.abunearegawi.backend.dto.PaymentStatsDTO getPaymentStats() {
        long totalMembers = memberRepository.count();

        // Approximate counts for now
        long contributingMembers = 0;
        long upToDateMembers = 0;
        long behindMembers = 0;

        BigDecimal totalMembershipCollected = BigDecimal.ZERO;

        LocalDate startOfYear = LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate endOfYear = LocalDate.of(LocalDate.now().getYear(), 12, 31);

        // Use correct repository method
        BigDecimal totalCollected = transactionRepository.sumTotalByDateRange(startOfYear, endOfYear);

        if (totalCollected == null)
            totalCollected = BigDecimal.ZERO;

        BigDecimal totalExpenses = ledgerEntryRepository.sumByTypeAndDateRange("expense", startOfYear, endOfYear);
        if (totalExpenses == null)
            totalExpenses = BigDecimal.ZERO;

        BigDecimal totalAmountDue = BigDecimal.ZERO;

        return new church.abunearegawi.backend.dto.PaymentStatsDTO(
                totalMembers,
                contributingMembers,
                upToDateMembers,
                behindMembers,
                totalAmountDue,
                totalMembershipCollected,
                BigDecimal.ZERO, // otherPayments
                totalCollected,
                totalExpenses,
                totalCollected.subtract(totalExpenses),
                0.0, // collectionRate
                BigDecimal.ZERO // outstandingAmount
        );
    }
}
