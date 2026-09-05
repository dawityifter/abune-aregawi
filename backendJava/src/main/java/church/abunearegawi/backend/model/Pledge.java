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
@Table(name = "pledges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pledge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "usd";

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "pledge_type", nullable = false)
    @Builder.Default
    private PledgeType pledgeType = PledgeType.general;

    @Column(name = "event_name")
    private String eventName;

    /**
     * The frozen outcome of the 2025 drive, and nothing else.
     *
     * <p>This entity previously mapped a {@code status} column that does not
     * exist; the schema's column is {@code legacy_status}, it is nullable, and
     * the Node backend deliberately stopped writing it. Fulfilment is not a
     * stored state any more — it is derived from pledge_allocations through the
     * pledge_balances view, so a pledge cannot disagree with the money.
     *
     * <p>Read-only here on purpose: writing it would recreate the drift that
     * moving to allocations removed.
     */
    @Column(name = "legacy_status", insertable = false, updatable = false)
    private String legacyStatus;

    /**
     * The drive this pledge belongs to. NOT NULL in the schema, and absent from
     * this entity until now — so every insert this port attempted would have
     * been rejected by the database.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false)
    private PledgeCampaign campaign;

    /**
     * {@code active} or {@code cancelled}. Replaces the old status enum as the
     * pledge's own lifecycle, independent of how much has been paid.
     */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String lifecycle = "active";

    /**
     * {@code later} or {@code immediate} — what the giver chose to do, recorded
     * once. Not a fulfilment state: an 'immediate' pledge is one that arrived
     * with its money, not one that has since been paid.
     */
    @Column(name = "fulfillment_intent", nullable = false, length = 16)
    @Builder.Default
    private String fulfillmentIntent = "later";

    /**
     * The giver's recorded wish, not the viewer's role. Masking happens on read
     * for everyone outside admin and treasurer.
     */
    @Column(name = "is_anonymous", nullable = false)
    @Builder.Default
    private Boolean isAnonymous = false;

    /**
     * How the church identifies an anonymous giver who has no member record.
     * A CHECK constraint requires this or a member_id whenever is_anonymous is
     * true, so an anonymous gift is never wholly untraceable internally.
     */
    @Column(name = "baptism_name")
    private String baptismName;

    /** Imported from a prior drive rather than pledged through the app. */
    @Column(name = "is_historical", nullable = false)
    @Builder.Default
    private Boolean isHistorical = false;

    @Column(name = "pledge_date", nullable = false)
    @Builder.Default
    private LocalDateTime pledgeDate = LocalDateTime.now();

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "fulfilled_date")
    private LocalDateTime fulfilledDate;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    private String email;
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "zip_code")
    private String zipCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donation_id")
    private Donation donation;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum PledgeType {
        general, event, fundraising, tithe
    }

    public enum Status {
        pending, fulfilled, expired, cancelled
    }
}
