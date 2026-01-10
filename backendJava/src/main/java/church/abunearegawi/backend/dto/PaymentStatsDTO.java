package church.abunearegawi.backend.dto;

import java.math.BigDecimal;

public record PaymentStatsDTO(
        long totalMembers,
        long contributingMembers,
        long upToDateMembers,
        long behindMembers,
        BigDecimal totalAmountDue,
        BigDecimal totalMembershipCollected,
        BigDecimal otherPayments,
        BigDecimal totalCollected,
        BigDecimal totalExpenses,
        BigDecimal netIncome,
        double collectionRate,
        BigDecimal outstandingAmount) {
}
