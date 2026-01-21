package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "firebase_uid", unique = true)
    private String firebaseUid;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "middle_name")
    private String middleName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(unique = true)
    private String email;

    @Column(name = "phone_number", nullable = false, unique = true)
    private String phoneNumber;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Column(name = "marital_status")
    @Enumerated(EnumType.STRING)
    private MaritalStatus maritalStatus;

    @Column(name = "baptism_name")
    private String baptismName;

    @Column(name = "repentance_father")
    private String repentanceFather;

    @Column(name = "household_size", nullable = false)
    @Builder.Default
    private Integer householdSize = 1;

    @Column(name = "street_line1")
    private String streetLine1;

    @Column(name = "apartment_no")
    private String apartmentNo;

    private String city;
    private String state;

    @Column(name = "postal_code")
    private String postalCode;

    @Builder.Default
    private String country = "USA";

    @Column(name = "emergency_contact_name")
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone")
    private String emergencyContactPhone;

    @Column(name = "yearly_pledge", precision = 10, scale = 2)
    private BigDecimal yearlyPledge;

    @Column(name = "date_joined_parish")
    private LocalDate dateJoinedParish;

    @Column(name = "spouse_name")
    private String spouseName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id")
    private Member familyHead;

    @OneToMany(mappedBy = "familyHead")
    private List<Member> familyMembers;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Role role = Role.member;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String roles = "[]";

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "is_imported", nullable = false)
    @Builder.Default
    private boolean isImported = false;

    @Column(name = "registration_status", nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RegistrationStatus registrationStatus = RegistrationStatus.pending;

    @Column(name = "is_welcomed", nullable = false)
    @Builder.Default
    private boolean isWelcomed = false;

    @Column(name = "welcomed_at")
    private LocalDateTime welcomedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "welcomed_by")
    private Member welcomedBy;

    @Column(name = "interested_in_serving")
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private InterestedInServing interestedInServing = InterestedInServing.maybe;

    @Column(name = "is_baptized")
    private Boolean isBaptized;

    @Column(columnDefinition = "TEXT")
    private String medicalConditions;

    @Column(columnDefinition = "TEXT")
    private String allergies;

    @Column(columnDefinition = "TEXT")
    private String medications;

    @Column(columnDefinition = "TEXT")
    private String dietaryRestrictions;

    @Column(columnDefinition = "TEXT")
    private String notes; // General notes about member/dependent

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Enums
    public enum Gender {
        male, female, other, Male, Female
    }

    public enum MaritalStatus {
        single, married, divorced, widowed, Single, Married, Divorced, Widowed
    }

    public enum Role {
        member, admin, treasurer, secretary, church_leadership, relationship, guest, deacon, priest, dependent,
        bookkeeper, budget_committee, auditor, ar_team, ap_team,
        Member, Admin, Treasurer, Secretary, Church_Leadership, Relationship, Guest, Deacon, Priest, Dependent,
        Bookkeeper, Budget_Committee, Auditor, AR_Team, AP_Team
    }

    public enum RegistrationStatus {
        pending, complete, incomplete
    }

    public enum InterestedInServing {
        yes, no, maybe
    }
}
