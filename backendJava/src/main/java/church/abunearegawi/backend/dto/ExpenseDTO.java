package church.abunearegawi.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

public record ExpenseDTO(
        Long id,
        String type,
        String category,
        @JsonProperty("category_name") String categoryName,
        @JsonProperty("category_description") String categoryDescription,
        BigDecimal amount,
        @JsonProperty("entry_date") LocalDate entryDate,
        @JsonProperty("payment_method") String paymentMethod,
        @JsonProperty("receipt_number") String receiptNumber,
        String memo,
        @JsonProperty("collected_by") Long collectedBy,
        @JsonProperty("member_id") Long memberId,
        @JsonProperty("transaction_id") Long transactionId,
        @JsonProperty("source_system") String sourceSystem,
        @JsonProperty("external_id") String externalId,
        String fund,
        @JsonProperty("attachment_url") String attachmentUrl,
        @JsonProperty("statement_date") LocalDate statementDate,
        @JsonProperty("employee_id") Object employeeId,
        @JsonProperty("vendor_id") Object vendorId,
        @JsonProperty("payee_name") String payeeName,
        @JsonProperty("check_number") String checkNumber,
        @JsonProperty("invoice_number") String invoiceNumber,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("updated_at") LocalDateTime updatedAt,
        Map<String, Object> collector,
        Map<String, Object> employee,
        Map<String, Object> vendor) {
}
