package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    /**
     * Who took the money. Null for an online gift, because nobody collected it.
     *
     * <p>The column was NOT NULL until the Node migration
     * 20260823100000-make-transaction-collected-by-nullable dropped it: an
     * anonymous online donation has no member and therefore no collector, and
     * the old constraint meant such a gift could not be written at all — it
     * stayed in Stripe, absent from the ledger. This entity still declared
     * nullable = false, which is stricter than the schema and would have
     * rejected exactly those gifts.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collected_by")
    private Member collector;

    @Column(name = "payment_date", nullable = false)
    @Builder.Default
    private LocalDate paymentDate = LocalDate.now();

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_type", nullable = false)
    private PaymentType paymentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.succeeded;

    @Column(name = "receipt_number", length = 100)
    private String receiptNumber;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "external_id", length = 191)
    private String externalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donation_id")
    private Donation donation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "income_category_id")
    private IncomeCategory incomeCategory;

    @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LedgerEntry> ledgerEntries;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum PaymentType {
        membership_due, tithe, offering, donation, vow, building_fund, event,
        religious_item_sales, tigray_hunger_fundraiser, loan_received, loan_repayment, other
    }

    public enum PaymentMethod {
        cash, check, zelle, credit_card, debit_card, ach, other
    }

    public enum Status {
        pending, succeeded, failed, canceled
    }
}
