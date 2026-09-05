package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * A fundraising drive. Pledges hang off one of these, and at most one is
 * <em>live</em> at a time.
 *
 * <p>"Live" is not the same as {@code status == active}: it also requires today
 * to fall inside the window. A drive that is active but finished shows nothing
 * to members, which is why the Node backend refuses to activate a campaign
 * whose end date has passed rather than reporting a success that changes
 * nothing. See {@code isLive}.
 *
 * <p>The table is owned by the Node backend's Sequelize migrations; this entity
 * only maps it.
 */
@Entity
@Table(name = "pledge_campaigns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PledgeCampaign {

    /** Only ever these three. Stored as a string, not a Postgres enum. */
    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_CLOSED = "closed";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(name = "name_ti")
    private String nameTi;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "description_ti", columnDefinition = "TEXT")
    private String descriptionTi;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** Null means open-ended: such a drive never expires. */
    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "goal_amount", precision = 10, scale = 2)
    private BigDecimal goalAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "usd";

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = STATUS_DRAFT;

    @Column(name = "default_payment_type", length = 50)
    private String defaultPaymentType;

    @Column(name = "income_category_id")
    private Long incomeCategoryId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    /** Anything that is not closed still accepts writes. */
    public boolean isOpen() {
        return !STATUS_CLOSED.equals(status);
    }

    /**
     * Whether members can actually see and pledge to this drive right now.
     *
     * <p>Active alone is not enough. A campaign whose window has passed is
     * invisible however its status reads, and treating the two as the same
     * thing is what lets an admin "activate" a finished drive and see no
     * effect anywhere.
     */
    public boolean isLive(LocalDate today) {
        if (!STATUS_ACTIVE.equals(status)) {
            return false;
        }
        if (startDate != null && startDate.isAfter(today)) {
            return false;
        }
        return endDate == null || !endDate.isBefore(today);
    }
}
