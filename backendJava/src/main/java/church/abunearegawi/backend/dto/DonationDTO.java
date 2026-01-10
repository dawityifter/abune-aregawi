package church.abunearegawi.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for Donation response
 */
public record DonationDTO(
        Long id,
        String stripePaymentIntentId,
        String stripeCustomerId,
        BigDecimal amount,
        String currency,
        String donationType,
        String frequency,
        String paymentMethod,
        String status,
        String donorFirstName,
        String donorLastName,
        String donorEmail,
        String donorPhone,
        String donorAddress,
        String donorZipCode,
        Map<String, Object> metadata,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
