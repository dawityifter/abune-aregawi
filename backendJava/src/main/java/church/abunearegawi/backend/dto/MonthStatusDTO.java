package church.abunearegawi.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthStatusDTO {
    private String month;
    private java.math.BigDecimal paid;
    private java.math.BigDecimal due;
    private String status; // paid, due, upcoming, pre-membership
    private boolean isFutureMonth;
}
