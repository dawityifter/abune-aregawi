package church.abunearegawi.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
public class ExpenseCreateRequest {
    @JsonProperty("gl_code")
    private String glCode;

    private BigDecimal amount;

    @JsonProperty("expense_date")
    private String expenseDate;

    @JsonProperty("payment_method")
    private String paymentMethod;

    @JsonProperty("receipt_number")
    private String receiptNumber;

    @JsonProperty("check_number")
    private String checkNumber;

    @JsonProperty("invoice_number")
    private String invoiceNumber;

    private String memo;

    @JsonProperty("employee_id")
    private UUID employeeId;

    @JsonProperty("vendor_id")
    private UUID vendorId;

    @JsonProperty("payee_name")
    private String payeeName;
}
