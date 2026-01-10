package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.Transaction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class TransactionCreateRequest {
    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be positive")
    private BigDecimal amount;

    @NotNull(message = "Payment type is required")
    private Transaction.PaymentType paymentType;

    private Transaction.PaymentMethod paymentMethod;

    private LocalDate paymentDate;

    private String note;

    private Long memberId;

    private Long incomeCategoryId;
}
