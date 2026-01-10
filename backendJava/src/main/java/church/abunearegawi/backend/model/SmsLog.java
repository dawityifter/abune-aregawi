package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "sms_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SmsLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private Member sender;

    @Column(nullable = false, length = 50)
    private String role;

    @Enumerated(EnumType.STRING)
    @Column(name = "recipient_type", nullable = false)
    private RecipientType recipientType;

    @Column(name = "recipient_member_id")
    private Long recipientMemberId;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "department_id")
    private Long departmentId;

    @Column(name = "recipient_count", nullable = false)
    @Builder.Default
    private Integer recipientCount = 1;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(columnDefinition = "TEXT")
    private String error;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum RecipientType {
        INDIVIDUAL("individual"),
        GROUP("group"),
        DEPARTMENT("department"),
        ALL("all");

        private final String value;

        RecipientType(String value) {
            this.value = value;
        }
    }

    public enum Status {
        SUCCESS("success"),
        PARTIAL("partial"),
        FAILED("failed");

        private final String value;

        Status(String value) {
            this.value = value;
        }
    }
}
