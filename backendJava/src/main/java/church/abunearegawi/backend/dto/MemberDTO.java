package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.Member;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDTO {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private String role;
    @JsonProperty("isActive")
    private boolean isActive;
    @JsonProperty("isWelcomed")
    private boolean isWelcomed;
    private String middleName;
    private String dateOfBirth;
    private String gender;
    private String maritalStatus;
    private String baptismName;
    private String streetLine1;
    private String apartmentNo;
    private String city;
    private String state;
    private String postalCode;
    private String country;
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String languagePreference;
    private String dateJoinedParish;
    private String interestedInServing;
    private Boolean isBaptized;
    private String medicalConditions;
    private String allergies;
    private String medications;
    private String dietaryRestrictions;
    private String notes;
    private String createdAt;
    private String updatedAt;

    private MemberDTO linkedMember;
    private String headOfHouseholdName;
    private List<MemberDTO> dependents;

    private java.util.List<String> roles;

    public static MemberDTO fromEntity(Member member) {
        return fromEntity(member, true);
    }

    public static MemberDTO fromEntity(Member member, boolean includeRelations) {
        java.util.List<String> rolesList = new java.util.ArrayList<>();
        if (member.getRoles() != null && member.getRoles().length() > 2) {
            String content = member.getRoles().substring(1, member.getRoles().length() - 1);
            if (!content.isBlank()) {
                String[] parts = content.split(",");
                for (String part : parts) {
                    String r = part.trim().replaceAll("\"", "");
                    if (!r.isBlank()) {
                        rolesList.add(r);
                    }
                }
            }
        }
        // Always add the primary role if not already in list
        if (member.getRole() != null) {
            String primaryRole = member.getRole().toString();
            if (!rolesList.contains(primaryRole)) {
                rolesList.add(primaryRole);
            }
        }

        MemberDTO dto = MemberDTO.builder()
                .id(member.getId())
                .firstName(member.getFirstName())
                .lastName(member.getLastName())
                .middleName(member.getMiddleName())
                .email(member.getEmail())
                .phoneNumber(member.getPhoneNumber())
                .role(member.getRole() != null ? member.getRole().toString() : null)
                .roles(rolesList)
                .isActive(member.isActive())
                .isWelcomed(member.isWelcomed())
                .dateOfBirth(member.getDateOfBirth() != null ? member.getDateOfBirth().toString() : null)
                .gender(member.getGender() != null ? member.getGender().toString() : null)
                .maritalStatus(member.getMaritalStatus() != null ? member.getMaritalStatus().toString() : null)
                .baptismName(member.getBaptismName())
                .streetLine1(member.getStreetLine1())
                .apartmentNo(member.getApartmentNo())
                .city(member.getCity())
                .state(member.getState())
                .postalCode(member.getPostalCode())
                .country(member.getCountry())
                .emergencyContactName(member.getEmergencyContactName())
                .emergencyContactPhone(member.getEmergencyContactPhone())
                .dateJoinedParish(member.getDateJoinedParish() != null ? member.getDateJoinedParish().toString() : null)
                .interestedInServing(
                        member.getInterestedInServing() != null ? member.getInterestedInServing().toString() : null)
                .isBaptized(member.getIsBaptized())
                .medicalConditions(member.getMedicalConditions())
                .allergies(member.getAllergies())
                .medications(member.getMedications())
                .dietaryRestrictions(member.getDietaryRestrictions())
                .notes(member.getNotes())
                .createdAt(member.getCreatedAt() != null ? member.getCreatedAt().toString() : null)
                .updatedAt(member.getUpdatedAt() != null ? member.getUpdatedAt().toString() : null)
                .build();

        if (includeRelations) {
            if (member.getFamilyHead() != null) {
                dto.setHeadOfHouseholdName(
                        member.getFamilyHead().getFirstName() + " " + member.getFamilyHead().getLastName());
                // Create a simplified DTO for linked member to avoid deep recursion
                MemberDTO headDto = new MemberDTO();
                headDto.setId(member.getFamilyHead().getId());
                headDto.setFirstName(member.getFamilyHead().getFirstName());
                headDto.setLastName(member.getFamilyHead().getLastName());
                headDto.setStreetLine1(member.getFamilyHead().getStreetLine1());
                headDto.setApartmentNo(member.getFamilyHead().getApartmentNo());
                headDto.setCity(member.getFamilyHead().getCity());
                headDto.setState(member.getFamilyHead().getState());
                headDto.setPostalCode(member.getFamilyHead().getPostalCode());
                dto.setLinkedMember(headDto);
            }

            if (member.getFamilyMembers() != null && !member.getFamilyMembers().isEmpty()) {
                dto.setDependents(member.getFamilyMembers().stream()
                        .map(dep -> {
                            // Pass false to prevent infinite recursion
                            MemberDTO depDto = fromEntity(dep, false);
                            // Clear cyclic references just in case
                            depDto.setLinkedMember(null);
                            depDto.setDependents(null);
                            return depDto;
                        })
                        .toList());
            }
        }

        return dto;
    }
}
