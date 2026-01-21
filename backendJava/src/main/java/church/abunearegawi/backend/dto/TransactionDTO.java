package church.abunearegawi.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for Transaction response
 */
public record TransactionDTO(
        Long id,
        @com.fasterxml.jackson.annotation.JsonProperty("payment_type") String type,
        BigDecimal amount,
        @com.fasterxml.jackson.annotation.JsonProperty("payment_date") LocalDate date,
        String description,
        @com.fasterxml.jackson.annotation.JsonProperty("payment_method") String paymentMethod,
        @com.fasterxml.jackson.annotation.JsonProperty("receipt_number") String checkNumber,
        @com.fasterxml.jackson.annotation.JsonProperty("member_id") Long memberId,
        @com.fasterxml.jackson.annotation.JsonProperty("member_name") String memberName,
        @com.fasterxml.jackson.annotation.JsonProperty("member") MemberDTO member,
        @com.fasterxml.jackson.annotation.JsonProperty("donation_id") Long donationId,
        @com.fasterxml.jackson.annotation.JsonProperty("income_category_id") Long incomeCategoryId,
        @com.fasterxml.jackson.annotation.JsonProperty("income_category_name") String incomeCategoryName,
        @com.fasterxml.jackson.annotation.JsonProperty("collected_by_id") Long collectedById,
        @com.fasterxml.jackson.annotation.JsonProperty("paid_by") String collectedByName,
        @com.fasterxml.jackson.annotation.JsonProperty("note") String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
