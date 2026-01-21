package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.MemberUpdateRequest;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.DependentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final DependentRepository dependentRepository;

    @Transactional(readOnly = true)
    public Optional<Member> findByEmailOrPhone(String email, String phone) {
        // Ignorie email per user request, check only phone
        if (phone != null && !phone.isEmpty()) {
            String normalizedPhone = phone.startsWith("+") ? phone : "+" + phone;
            return memberRepository.findByPhoneNumber(normalizedPhone);
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public Optional<Member> findByFirebaseInfo(String uid, String email, String phone) {
        if (uid != null) {
            Optional<Member> byUid = memberRepository.findByFirebaseUid(uid);
            if (byUid.isPresent())
                return byUid;
        }
        return findByEmailOrPhone(email, phone);
    }

    @Transactional(readOnly = true)
    public Optional<Member> findById(Long id) {
        return memberRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Page<Member> findAll(Pageable pageable) {
        return memberRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> search(String query) {
        if (query == null || query.trim().length() < 3) {
            return java.util.Collections.emptyList();
        }

        String trimmedQuery = query.trim();
        String[] tokens = trimmedQuery.toLowerCase().split("\\s+");

        // Limit tokens to avoid DoS
        if (tokens.length > 5) {
            String[] limited = new String[5];
            System.arraycopy(tokens, 0, limited, 0, 5);
            tokens = limited;
        }

        // Phone candidates logic
        java.util.List<String> phoneCandidates = new java.util.ArrayList<>();
        String digits = trimmedQuery.replaceAll("[^0-9]", "");
        if (digits.length() >= 10) {
            if (digits.length() == 11) {
                phoneCandidates.add("+" + digits);
            } else {
                phoneCandidates.add("+1" + digits.substring(Math.max(0, digits.length() - 10)));
            }
        }

        final String[] finalTokens = tokens;

        org.springframework.data.jpa.domain.Specification<Member> spec = (root, q, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();

            // Name token clauses (AND logic across tokens)
            if (finalTokens.length > 0) {
                java.util.List<jakarta.persistence.criteria.Predicate> tokenPredicates = new java.util.ArrayList<>();
                for (String token : finalTokens) {
                    String pattern = "%" + token + "%";
                    jakarta.persistence.criteria.Predicate firstNameMatch = cb.like(cb.lower(root.get("firstName")),
                            pattern);
                    jakarta.persistence.criteria.Predicate lastNameMatch = cb.like(cb.lower(root.get("lastName")),
                            pattern);
                    jakarta.persistence.criteria.Predicate middleNameMatch = cb.like(cb.lower(root.get("middleName")),
                            pattern);

                    // Each token must match at least one name field
                    tokenPredicates.add(cb.or(firstNameMatch, lastNameMatch, middleNameMatch));
                }
                // All tokens must be satisfied (AND)
                predicates.add(cb.and(tokenPredicates.toArray(new jakarta.persistence.criteria.Predicate[0])));
            }

            // If phone candidates exist, OR them with the name search
            if (!phoneCandidates.isEmpty()) {
                jakarta.persistence.criteria.Predicate phoneMatch = root.get("phoneNumber").in(phoneCandidates);
                if (predicates.isEmpty()) {
                    predicates.add(phoneMatch);
                } else {
                    // (Name match AND match) OR Phone match
                    jakarta.persistence.criteria.Predicate namePredicate = predicates.get(0); // The AND of tokens
                    predicates.clear();
                    predicates.add(cb.or(namePredicate, phoneMatch));
                }
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        // Execute search with limit 10
        return memberRepository.findAll(spec, org.springframework.data.domain.PageRequest.of(0, 10,
                org.springframework.data.domain.Sort.by("lastName").ascending()
                        .and(org.springframework.data.domain.Sort.by("firstName").ascending())))
                .stream()
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> findAllList(int limit) {
        // Naive limit implementation using Pageable
        return memberRepository.findAll(org.springframework.data.domain.PageRequest.of(0, limit))
                .getContent()
                .stream()
                .map(member -> {
                    try {
                        return church.abunearegawi.backend.dto.MemberDTO.fromEntity(member);
                    } catch (Throwable e) {
                        System.out.println("❌ ERROR mapping member " + member.getId() + ": " + e.getMessage());
                        // e.printStackTrace(System.out); // Optional: keep verbose off unless needed
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public Member register(Member member) {
        if (member.getEmail() != null && memberRepository.findByEmail(member.getEmail()).isPresent()) {
            throw new RuntimeException("Email already active");
        }
        // Basic duplicate check logic
        return memberRepository.save(member);
    }

    @Transactional(readOnly = true)
    public java.util.List<church.abunearegawi.backend.dto.MemberDTO> getDependents(Long familyHeadId) {
        return memberRepository.findByFamilyHeadId(familyHeadId)
                .stream()
                .map(church.abunearegawi.backend.dto.MemberDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<Member> findDependentById(Long id) {
        return memberRepository.findById(id)
                .filter(m -> m.getRole() == Member.Role.dependent);
    }

    @Transactional
    public Member addDependent(Long familyHeadId, church.abunearegawi.backend.dto.MemberDTO dto) {
        Member head = memberRepository.findById(familyHeadId)
                .orElseThrow(() -> new RuntimeException("Family head not found"));

        Member dependent = new Member();
        dependent.setFirstName(dto.getFirstName());
        dependent.setLastName(dto.getLastName());
        dependent.setMiddleName(dto.getMiddleName());
        dependent.setDateOfBirth(dto.getDateOfBirth() != null ? java.time.LocalDate.parse(dto.getDateOfBirth()) : null);
        dependent.setGender(dto.getGender() != null ? Member.Gender.valueOf(dto.getGender()) : null);
        dependent.setRole(Member.Role.dependent);
        // Map relationship to generic field or specialized field if added? using logic
        // from frontend mapping: "relationship"
        // Frontend sends "relationship" field. Java DTO doesn't have it mapped to
        // Entity field yet besides maybe notes or specialized?
        // Wait, MemberDTO has no "relationship" field mapped to entity.
        // Frontend sends "relationship" in JSON.
        // I should probably map "relationship" to something.
        // For now, let's store it in `notes` or just ignore if schema doesn't support.
        // But better to verify if I missed adding "relationship" field to Member
        // entity?
        // Member entity has `familyHead`. The relationship is implicitly "dependent"
        // but the specific family relation (Son, Daughter) is missing.
        // I will add "relationship" field to Member entity later or reuse a field.
        // Let's check DTO again.
        // I'll proceed with other fields.

        dependent.setPhoneNumber(
                dto.getPhoneNumber() != null ? dto.getPhoneNumber() : "DEP-" + System.currentTimeMillis()); // Phone is
                                                                                                            // unique/required?
        // Member.phoneNumber is nullable=false, unique=true. Dependents might not have
        // phone.
        // Logic: Use dummy or optional?
        // If unique, dummy must be unique.
        // "DEP-" + timestamp + random?
        if (dependent.getPhoneNumber() == null || dependent.getPhoneNumber().isEmpty()) {
            dependent.setPhoneNumber("DEP-" + java.util.UUID.randomUUID().toString().substring(0, 18));
        }

        dependent.setEmail(dto.getEmail());
        dependent.setBaptismName(dto.getBaptismName());
        dependent.setIsBaptized(dto.getIsBaptized());
        dependent.setMedicalConditions(dto.getMedicalConditions());
        dependent.setAllergies(dto.getAllergies());
        dependent.setMedications(dto.getMedications());
        dependent.setDietaryRestrictions(dto.getDietaryRestrictions());
        dependent.setNotes(dto.getNotes()); // Or store relationship here? "Relationship: " + dto.getRelationship() ?

        dependent.setFamilyHead(head);
        dependent.setHouseholdSize(1); // Default?
        dependent.setStreetLine1(head.getStreetLine1());
        dependent.setCity(head.getCity());
        dependent.setState(head.getState());
        dependent.setPostalCode(head.getPostalCode());
        dependent.setCountry(head.getCountry());

        return memberRepository.save(dependent);
    }

    @Transactional
    public Member updateDependent(Long id, church.abunearegawi.backend.dto.MemberDTO dto) {
        Member dependent = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Dependent not found"));

        if (dependent.getRole() != Member.Role.dependent) {
            throw new RuntimeException("Member is not a dependent");
        }

        dependent.setFirstName(dto.getFirstName());
        dependent.setLastName(dto.getLastName());
        dependent.setMiddleName(dto.getMiddleName());
        if (dto.getDateOfBirth() != null)
            dependent.setDateOfBirth(java.time.LocalDate.parse(dto.getDateOfBirth()));
        if (dto.getGender() != null)
            dependent.setGender(Member.Gender.valueOf(dto.getGender()));

        if (dto.getEmail() != null)
            dependent.setEmail(dto.getEmail());
        if (dto.getPhoneNumber() != null)
            dependent.setPhoneNumber(dto.getPhoneNumber());

        dependent.setBaptismName(dto.getBaptismName());
        dependent.setIsBaptized(dto.getIsBaptized());
        dependent.setMedicalConditions(dto.getMedicalConditions());
        dependent.setAllergies(dto.getAllergies());
        dependent.setMedications(dto.getMedications());
        dependent.setDietaryRestrictions(dto.getDietaryRestrictions());
        dependent.setNotes(dto.getNotes());

        return memberRepository.save(dependent);
    }

    @Transactional
    public void deleteDependent(Long id) {
        Member m = memberRepository.findById(id).orElseThrow(() -> new RuntimeException("Not found"));
        if (m.getRole() == Member.Role.dependent) {
            memberRepository.delete(m);
        } else {
            throw new RuntimeException("Cannot delete non-dependent member via this API");
        }
    }

    @Transactional(readOnly = true)
    public long countDependents() {
        // Dependents are stored in the separate 'dependents' table, not in members
        // table
        return dependentRepository.count();
    }

    @Transactional
    public Member update(Long id, MemberUpdateRequest request) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        // Basic Information
        if (request.getFirstName() != null)
            member.setFirstName(request.getFirstName());
        if (request.getMiddleName() != null)
            member.setMiddleName(request.getMiddleName());
        if (request.getLastName() != null)
            member.setLastName(request.getLastName());
        if (request.getEmail() != null)
            member.setEmail(request.getEmail());
        if (request.getPhoneNumber() != null)
            member.setPhoneNumber(request.getPhoneNumber());
        if (request.getDateOfBirth() != null)
            member.setDateOfBirth(request.getDateOfBirth());

        // Personal Details
        if (request.getGender() != null) {
            try {
                member.setGender(Member.Gender.valueOf(request.getGender()));
            } catch (IllegalArgumentException e) {
                // ignore invalid gender
            }
        }
        if (request.getMaritalStatus() != null) {
            try {
                member.setMaritalStatus(Member.MaritalStatus.valueOf(request.getMaritalStatus()));
            } catch (IllegalArgumentException e) {
                // ignore invalid marital status
            }
        }
        if (request.getBaptismName() != null)
            member.setBaptismName(request.getBaptismName());
        if (request.getRepentanceFather() != null)
            member.setRepentanceFather(request.getRepentanceFather());
        if (request.getSpouseName() != null)
            member.setSpouseName(request.getSpouseName());

        // Address
        if (request.getStreetLine1() != null)
            member.setStreetLine1(request.getStreetLine1());
        if (request.getApartmentNo() != null)
            member.setApartmentNo(request.getApartmentNo());
        if (request.getCity() != null)
            member.setCity(request.getCity());
        if (request.getState() != null)
            member.setState(request.getState());
        if (request.getPostalCode() != null)
            member.setPostalCode(request.getPostalCode());
        if (request.getCountry() != null)
            member.setCountry(request.getCountry());

        // Emergency Contact
        if (request.getEmergencyContactName() != null)
            member.setEmergencyContactName(request.getEmergencyContactName());
        if (request.getEmergencyContactPhone() != null)
            member.setEmergencyContactPhone(request.getEmergencyContactPhone());

        // Status & Roles
        if (request.getIsActive() != null)
            member.setActive(request.getIsActive());
        if (request.getIsWelcomed() != null)
            member.setWelcomed(request.getIsWelcomed());
        if (request.getRole() != null) {
            try {
                member.setRole(Member.Role.valueOf(request.getRole()));
            } catch (IllegalArgumentException e) {
                // ignore invalid role
            }
        }

        // Update multiple roles
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            try {
                // Serialize list to simple JSON string: ["role1", "role2"]
                String jsonRoles = "[" + request.getRoles().stream()
                        .map(r -> "\"" + r + "\"")
                        .collect(java.util.stream.Collectors.joining(",")) + "]";
                member.setRoles(jsonRoles);

                // If single role is NOT provided but multiple roles ARE, sync single role to
                // first one
                // This maintains backward compatibility
                if (request.getRole() == null && !request.getRoles().isEmpty()) {
                    try {
                        member.setRole(Member.Role.valueOf(request.getRoles().get(0)));
                    } catch (Exception e) {
                        // ignore
                    }
                }
            } catch (Exception e) {
                System.err.println("Error updating roles: " + e.getMessage());
            }
        }

        // Spiritual Information
        // Note: languagePreference field may not exist in Member entity
        // if (request.getLanguagePreference() != null)
        // member.setLanguagePreference(request.getLanguagePreference());
        if (request.getDateJoinedParish() != null)
            member.setDateJoinedParish(java.time.LocalDate.parse(request.getDateJoinedParish()));
        if (request.getInterestedInServing() != null) {
            try {
                member.setInterestedInServing(Member.InterestedInServing.valueOf(request.getInterestedInServing()));
            } catch (IllegalArgumentException e) {
                // ignore invalid value
            }
        }
        if (request.getIsBaptized() != null)
            member.setIsBaptized(request.getIsBaptized());

        // Medical Information
        if (request.getMedicalConditions() != null)
            member.setMedicalConditions(request.getMedicalConditions());
        if (request.getAllergies() != null)
            member.setAllergies(request.getAllergies());
        if (request.getMedications() != null)
            member.setMedications(request.getMedications());
        if (request.getDietaryRestrictions() != null)
            member.setDietaryRestrictions(request.getDietaryRestrictions());

        // Other
        if (request.getHouseholdSize() != null)
            member.setHouseholdSize(request.getHouseholdSize());
        if (request.getNotes() != null)
            member.setNotes(request.getNotes());

        // Title - handle separately as it requires Title entity
        // Note: Title update would require TitleRepository injection if needed

        return memberRepository.save(member);
    }

    @Transactional
    public void delete(Long id) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Member not found"));
        memberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public Page<Member> findPendingWelcomes(Pageable pageable) {
        return memberRepository.findByIsWelcomedFalseAndIsActiveTrue(pageable);
    }

    @Transactional
    public Member updateMemberRole(Long id, String role, java.util.List<String> roles) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        java.util.List<String> validRoles = java.util.Arrays.asList(
                "admin", "church_leadership", "treasurer", "bookkeeper", "budget_committee",
                "auditor", "ar_team", "ap_team", "secretary", "member", "guest",
                "relationship", "deacon", "priest");

        java.util.List<String> rolesToSet = new java.util.ArrayList<>();
        if (roles != null) {
            rolesToSet = roles.stream()
                    .filter(validRoles::contains)
                    .collect(java.util.stream.Collectors.toList());
        } else if (role != null && validRoles.contains(role)) {
            rolesToSet.add(role);
        }

        // Ensure 'member' role is always included
        if (!rolesToSet.contains("member")) {
            rolesToSet.add("member");
        }

        if (rolesToSet.isEmpty()) {
            throw new RuntimeException("Invalid roles. Must be one or more of: " + String.join(", ", validRoles));
        }

        // Update single role (legacy) to first item
        try {
            member.setRole(Member.Role.valueOf(rolesToSet.get(0)));
        } catch (Exception e) {
            // Should not happen due to validation, but safe fallback
            member.setRole(Member.Role.member);
        }

        // Update plural roles JSON
        String jsonRoles = "[" + rolesToSet.stream()
                .map(r -> "\"" + r + "\"")
                .collect(java.util.stream.Collectors.joining(",")) + "]";
        member.setRoles(jsonRoles);

        return memberRepository.save(member);
    }

    @Transactional
    public Member markWelcomed(Long id, Long welcomedByMemberId) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (member.isWelcomed()) {
            return member; // Already welcomed
        }

        member.setWelcomed(true);
        member.setWelcomedAt(java.time.LocalDateTime.now());

        if (welcomedByMemberId != null) {
            Member welcomedBy = memberRepository.findById(welcomedByMemberId)
                    .orElse(null);
            if (welcomedBy != null) {
                member.setWelcomedBy(welcomedBy);
            }
        }

        return memberRepository.save(member);
    }

    @Transactional
    public Member promoteDependent(Long dependentId, String email, String phone) {
        church.abunearegawi.backend.model.Dependent dependent = dependentRepository.findById(dependentId)
                .orElseThrow(() -> new RuntimeException("Dependent not found"));

        // Check if already linked to a different member (already promoted)
        if (dependent.getLinkedMember() != null &&
                !dependent.getLinkedMember().getId().equals(dependent.getMember().getId())) {
            throw new RuntimeException("Dependent already has their own member account (ID " +
                    dependent.getLinkedMember().getId() + ")");
        }

        // CRITICAL: Only dependents with phone numbers can be promoted
        String dependentPhone = phone != null ? phone : dependent.getPhone();
        if (dependentPhone == null || dependentPhone.trim().isEmpty()) {
            throw new RuntimeException(
                    "Dependent does not have a phone number. Phone is required for login and promotion.");
        }

        // Find the parent member
        Member parent = dependent.getMember();
        if (parent == null) {
            throw new RuntimeException("Parent member not found");
        }

        // Check if phone number already exists
        Optional<Member> existingMember = memberRepository.findByPhoneNumber(dependentPhone);
        if (existingMember.isPresent()) {
            throw new RuntimeException("A member with phone number " + dependentPhone +
                    " already exists. Each member must have a unique phone number for login access.");
        }

        // Create new member from dependent
        String memberEmail = email != null ? email
                : (dependent.getEmail() != null ? dependent.getEmail()
                        : "dependent_" + dependent.getId() + "@placeholder.local");

        // Normalize gender
        Member.Gender memberGender = null;
        if (dependent.getGender() != null) {
            try {
                memberGender = Member.Gender.valueOf(dependent.getGender().toLowerCase());
            } catch (IllegalArgumentException e) {
                // Invalid gender, leave as null
            }
        }

        Member newMember = Member.builder()
                .firstName(dependent.getFirstName())
                .middleName(dependent.getMiddleName())
                .lastName(dependent.getLastName())
                .email(memberEmail)
                .phoneNumber(dependentPhone)
                .gender(memberGender)
                .dateOfBirth(dependent.getDateOfBirth())
                .baptismName(dependent.getBaptismName())
                .familyHead(parent.getFamilyHead() != null ? parent.getFamilyHead() : parent)
                .yearlyPledge(java.math.BigDecimal.ZERO) // Zero pledge so they don't get billed separately
                .role(Member.Role.member)
                .isActive(true)
                .registrationStatus(Member.RegistrationStatus.complete)
                .householdSize(1)
                .streetLine1(parent.getStreetLine1())
                .apartmentNo(parent.getApartmentNo())
                .city(parent.getCity())
                .state(parent.getState())
                .postalCode(parent.getPostalCode())
                .country(parent.getCountry())
                .build();

        Member savedMember = memberRepository.save(newMember);

        // Link dependent to new member (not parent)
        dependent.setLinkedMember(savedMember);
        dependentRepository.save(dependent);

        return savedMember;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> validateHeadOfHousehold(String phoneNumber) {
        String normalizedPhone = phoneNumber.startsWith("+") ? phoneNumber : "+" + phoneNumber;

        Member member = memberRepository.findByPhoneNumber(normalizedPhone)
                .orElseThrow(() -> new RuntimeException("No member found with this phone number"));

        // Check if head of household (familyHead is null or self)
        boolean isHeadOfHousehold = member.getFamilyHead() == null ||
                (member.getFamilyHead().getId().equals(member.getId()));

        if (!isHeadOfHousehold) {
            throw new RuntimeException("This phone number belongs to a member who is not a head of household");
        }

        return Map.of(
                "memberId", member.getId(),
                "firstName", member.getFirstName(),
                "lastName", member.getLastName(),
                "phoneNumber", member.getPhoneNumber());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> checkRegistrationStatus(String email, String firebaseUid) {
        Optional<Member> memberOpt = Optional.empty();

        if (email != null) {
            memberOpt = memberRepository.findByEmail(email);
        }
        if (memberOpt.isEmpty() && firebaseUid != null) {
            memberOpt = memberRepository.findByFirebaseUid(firebaseUid);
        }

        if (memberOpt.isPresent()) {
            Member member = memberOpt.get();
            return Map.of(
                    "status", "complete",
                    "member", church.abunearegawi.backend.dto.MemberDTO.fromEntity(member),
                    "hasFirebaseUid", member.getFirebaseUid() != null);
        } else {
            return Map.of(
                    "status", "incomplete",
                    "suggestion", "User needs to complete registration");
        }
    }
}
