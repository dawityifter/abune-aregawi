package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "member_payments_2024")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "member_id")
    private UUID memberId;

    @Column(name = "member_name", nullable = false)
    private String memberName;

    @Column(name = "spouse_name")
    private String spouseName;

    @Column(name = "phone_1")
    private String phone1;

    @Column(name = "phone_2")
    private String phone2;

    private Integer year;

    @Column(name = "payment_method")
    private String paymentMethod;

    @Column(name = "monthly_payment", precision = 10, scale = 2)
    private BigDecimal monthlyPayment;

    @Column(name = "total_amount_due", precision = 10, scale = 2)
    private BigDecimal totalAmountDue;

    // Monthly payment columns
    @Column(precision = 10, scale = 2)
    private BigDecimal january;

    @Column(precision = 10, scale = 2)
    private BigDecimal february;

    @Column(precision = 10, scale = 2)
    private BigDecimal march;

    @Column(precision = 10, scale = 2)
    private BigDecimal april;

    @Column(precision = 10, scale = 2)
    private BigDecimal may;

    @Column(precision = 10, scale = 2)
    private BigDecimal june;

    @Column(precision = 10, scale = 2)
    private BigDecimal july;

    @Column(precision = 10, scale = 2)
    private BigDecimal august;

    @Column(precision = 10, scale = 2)
    private BigDecimal september;

    @Column(precision = 10, scale = 2)
    private BigDecimal october;

    @Column(precision = 10, scale = 2)
    private BigDecimal november;

    @Column(precision = 10, scale = 2)
    private BigDecimal december;

    @Column(name = "total_collected", precision = 10, scale = 2)
    private BigDecimal totalCollected;

    @Column(name = "balance_due", precision = 10, scale = 2)
    private BigDecimal balanceDue;

    @Column(name = "paid_up_to_date")
    private String paidUpToDate;

    @Column(name = "number_of_household")
    private Integer numberOfHousehold;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
