package church.abunearegawi.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for MemberPayment response
 */
public record MemberPaymentDTO(
        Integer id,
        UUID memberId,
        String memberName,
        String spouseName,
        String phone1,
        String phone2,
        Integer year,
        String paymentMethod,
        BigDecimal monthlyPayment,
        BigDecimal totalAmountDue,
        BigDecimal january,
        BigDecimal february,
        BigDecimal march,
        BigDecimal april,
        BigDecimal may,
        BigDecimal june,
        BigDecimal july,
        BigDecimal august,
        BigDecimal september,
        BigDecimal october,
        BigDecimal november,
        BigDecimal december,
        BigDecimal totalCollected,
        BigDecimal balanceDue,
        String paidUpToDate,
        Integer numberOfHousehold,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
