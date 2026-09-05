package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A payment, or part of one, credited against a pledge.
 *
 * <p><strong>Append-only.</strong> A Postgres trigger blocks UPDATE and DELETE
 * on this table. A mistake is corrected by inserting a negative row that
 * reverses the original and carries a mandatory reason, so the record of what
 * was believed at the time survives the correction. Any Java code that tries to
 * mutate or remove a row will fail at the database, by design — do not add a
 * setter-driven update path here.
 *
 * <p>Fulfilment is derived by summing these, never stored on the pledge. That
 * is why {@code pledges.legacy_status} is frozen: a stored status can disagree
 * with the money, a sum cannot.
 */
@Entity
@Table(name = "pledge_allocations")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PledgeAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pledge_id", nullable = false)
    private Long pledgeId;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    /**
     * Negative on a reversing row. Not constrained to be positive here on
     * purpose — that is the mechanism corrections rely on.
     */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /**
     * Where the credit came from: the automatic path after an online payment,
     * or a treasurer recording one. Widening this is a schema change — the
     * column carries a CHECK constraint the Node migrations own, which is what
     * Zelle, bank and Square allocation would each need extending.
     */
    @Column(nullable = false, length = 32)
    private String source;

    /** The only values the source CHECK constraint permits. */
    public static final String SOURCE_STRIPE_AUTO = "stripe_auto";
    public static final String SOURCE_TREASURER_MANUAL = "treasurer_manual";
    public static final String SOURCE_MIGRATION = "migration";
    public static final String SOURCE_STRIPE_REFUND = "stripe_refund";

    /** The member who recorded it; null for allocations the system made. */
    @Column(name = "allocated_by")
    private Long allocatedBy;

    /** Mandatory in practice for a reversal: why the correction was made. */
    @Column(columnDefinition = "TEXT")
    private String reason;

    /** Set on a reversing row, pointing at the row it cancels. */
    @Column(name = "reverses_allocation_id")
    private Long reversesAllocationId;

    /**
     * Guards against a webhook delivered twice creating the credit twice.
     * Stripe redelivers on its own schedule, so this is load-bearing rather
     * than defensive.
     */
    @Column(name = "idempotency_key")
    private String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** A reversing row rather than an original credit. */
    public boolean isReversal() {
        return reversesAllocationId != null;
    }
}
