package church.abunearegawi.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DuesDetailsDTO {
    private MemberDTO member;
    private HouseholdInfoDTO household;
    private PaymentSummaryDTO payment;
    private List<TransactionDTO> transactions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentSummaryDTO {
        private Integer year;
        private java.math.BigDecimal annualPledge;
        private java.math.BigDecimal monthlyPayment;
        private java.math.BigDecimal totalAmountDue;
        private java.math.BigDecimal duesCollected;
        private java.math.BigDecimal outstandingDues;
        private java.math.BigDecimal duesProgress;
        private java.math.BigDecimal futureDues;
        private java.math.BigDecimal totalOtherContributions;
        private java.math.BigDecimal grandTotal;

        private List<MonthStatusDTO> monthStatuses;
        private OtherContributionsDTO otherContributions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HouseholdInfoDTO {
        private boolean isHouseholdView;
        private MemberDTO headOfHousehold;
        private String memberNames;
        private int totalMembers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OtherContributionsDTO {
        private java.math.BigDecimal donation;
        private java.math.BigDecimal pledge_payment;
        private java.math.BigDecimal tithe;
        private java.math.BigDecimal offering;
        private java.math.BigDecimal other;
    }
}
