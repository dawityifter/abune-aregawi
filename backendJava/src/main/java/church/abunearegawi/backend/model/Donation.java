package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "donations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Donation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stripe_payment_intent_id", nullable = false, unique = true)
    private String stripePaymentIntentId;

    @Column(name = "stripe_customer_id")
    private String stripeCustomerId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "usd";

    @Enumerated(EnumType.STRING)
    @Column(name = "donation_type", nullable = false)
    private DonationType donationType;

    @Enumerated(EnumType.STRING)
    private Frequency frequency;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.pending;

    @Column(name = "donor_first_name")
    private String donorFirstName;

    @Column(name = "donor_last_name")
    private String donorLastName;

    @Column(name = "donor_email")
    private String donorEmail;

    @Column(name = "donor_phone")
    private String donorPhone;

    @Column(name = "donor_address", columnDefinition = "TEXT")
    private String donorAddress;

    @Column(name = "donor_zip_code")
    private String donorZipCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum DonationType {
        @Column(name = "one-time")
        ONE_TIME("one-time"),
        @Column(name = "recurring")
        RECURRING("recurring");

        private final String value;

        DonationType(String value) {
            this.value = value;
        }
    }

    public enum Frequency {
        weekly, monthly, quarterly, yearly
    }

    public enum PaymentMethod {
        card, ach
    }

    public enum Status {
        pending, succeeded, failed, canceled
    }
}
