package church.abunearegawi.backend.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class MemberUpdateRequest {
    private String firstName;
    private String middleName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private LocalDate dateOfBirth;
    private String gender;
    private String maritalStatus;
    private String baptismName;
    private String repentanceFather;
    private Integer householdSize;
    private String streetLine1;
    private String apartmentNo;
    private String city;
    private String state;
    private String postalCode;
    private String country;
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String role;
    private Boolean isActive;
    private Boolean isWelcomed;
    private String languagePreference;
    private String dateJoinedParish;
    private String interestedInServing;
    private Boolean isBaptized;
    private String medicalConditions;
    private String allergies;
    private String medications;
    private String dietaryRestrictions;
    private String notes;
    private Long titleId;
    private String spouseName;
    private java.util.List<MemberDTO> dependents; // For updating dependents
    private java.util.List<String> roles; // Support for multiple roles
}
