package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "employees")
@SQLDelete(sql = "UPDATE employees SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(length = 100)
    private String position;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", nullable = false)
    @Builder.Default
    private EmploymentType employmentType = EmploymentType.PART_TIME;

    @Column(length = 255)
    private String email;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "ssn_last_four", length = 4)
    private String ssnLastFour;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "termination_date")
    private LocalDate terminationDate;

    @Column(name = "salary_amount", precision = 10, scale = 2)
    private BigDecimal salaryAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "salary_frequency")
    private SalaryFrequency salaryFrequency;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "tax_id", length = 50)
    private String taxId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "employee")
    private List<LedgerEntry> expenses;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public enum EmploymentType {
        FULL_TIME, PART_TIME, CONTRACT, VOLUNTEER
    }

    public enum SalaryFrequency {
        WEEKLY, BI_WEEKLY, MONTHLY, ANNUAL, PER_SERVICE
    }
}
