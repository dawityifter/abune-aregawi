package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.dto.MemberCreateRequest;
import church.abunearegawi.backend.dto.MemberDTO;
import church.abunearegawi.backend.dto.MemberUpdateRequest;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;
    private final church.abunearegawi.backend.repository.TitleRepository titleRepository;

    @GetMapping("/titles")
    public ResponseEntity<ApiResponse<java.util.List<church.abunearegawi.backend.model.Title>>> getTitles() {
        return ResponseEntity.ok(ApiResponse.success(titleRepository.findAllByOrderByPriorityAsc()));
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<MemberDTO>> getProfile(@AuthenticationPrincipal FirebaseUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        return memberService.findById(userDetails.getMemberId())
                .map(member -> ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(member))))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/profile/firebase/{uid}")
    public ResponseEntity<ApiResponse<MemberDTO>> getProfileByFirebaseUid(
            @PathVariable String uid,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone) {

        return memberService.findByFirebaseInfo(uid, email, phone)
                .map(member -> ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(member))))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Page<MemberDTO>>> getAllMembers(Pageable pageable) {
        Page<Member> members = memberService.findAll(pageable);
        Page<MemberDTO> dtos = members.map(MemberDTO::fromEntity);
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    @GetMapping("/all/firebase")
    public ResponseEntity<ApiResponse<java.util.List<MemberDTO>>> getAllMembersLegacy(
            @RequestParam(name = "limit", defaultValue = "1000") Integer limit,
            @RequestParam(name = "search", required = false) String search) {

        if (search != null && !search.trim().isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(memberService.search(search)));
        }

        System.out.println("DEBUG: Entering getAllMembersLegacy with limit=" + limit);
        return ResponseEntity.ok(ApiResponse.success(memberService.findAllList(limit)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<java.util.List<MemberDTO>>> searchMembers(@RequestParam("q") String query) {
        return ResponseEntity.ok(ApiResponse.success(memberService.search(query)));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<MemberDTO>> register(@Valid @RequestBody MemberCreateRequest request) {
        Member member = new Member();
        member.setFirstName(request.getFirstName());
        member.setLastName(request.getLastName());
        member.setEmail(request.getEmail());
        member.setPhoneNumber(request.getPhoneNumber());
        member.setFirebaseUid(request.getFirebaseUid());

        if (request.getDateOfBirth() != null)
            member.setDateOfBirth(request.getDateOfBirth());
        // Set defaults
        member.setRole(Member.Role.member);

        Member saved = memberService.register(member);
        return ResponseEntity.created(URI.create("/api/members/" + saved.getId()))
                .body(ApiResponse.success(MemberDTO.fromEntity(saved), "Registration successful"));
    }

    @GetMapping("/{id:\\d+}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY') or #id == authentication.principal.id")
    public ResponseEntity<ApiResponse<MemberDTO>> getMember(@PathVariable Long id) {
        return memberService.findById(id)
                .map(member -> ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(member))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id:\\d+}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY') or #id == authentication.principal.id")
    public ResponseEntity<ApiResponse<MemberDTO>> updateMember(@PathVariable Long id,
            @RequestBody MemberUpdateRequest request) {
        Member updated = memberService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(updated)));
    }

    @PatchMapping("/{id:\\d+}/role")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> updateMemberRole(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> request) {

        String role = (String) request.get("role");
        @SuppressWarnings("unchecked")
        java.util.List<String> roles = (java.util.List<String>) request.get("roles");

        Member updated = memberService.updateMemberRole(id, role, roles);

        return ResponseEntity.ok(ApiResponse.success(
                java.util.Map.of("member", MemberDTO.fromEntity(updated)),
                "Member role updated successfully"));
    }

    @GetMapping("/{id:\\d+}/dependents")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getMemberDependents(@PathVariable Long id) {
        java.util.List<MemberDTO> dependents = memberService.getDependents(id);
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("dependents", dependents)));
    }

    @PostMapping("/{id:\\d+}/dependents")
    public ResponseEntity<ApiResponse<MemberDTO>> addDependent(@PathVariable Long id,
            @RequestBody MemberDTO dependentDto) {
        Member saved = memberService.addDependent(id, dependentDto);
        return ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(saved)));
    }

    @GetMapping("/dependents/count")
    public ResponseEntity<ApiResponse<java.util.Map<String, Long>>> getDependentsCount() {
        long count = memberService.countDependents();
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("count", count)));
    }

    @GetMapping("/dependents/{id:\\d+}")
    public ResponseEntity<ApiResponse<MemberDTO>> getDependent(@PathVariable Long id) {
        return memberService.findDependentById(id)
                .map(d -> ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(d))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/dependents/{id:\\d+}")
    public ResponseEntity<ApiResponse<MemberDTO>> updateDependent(@PathVariable Long id,
            @RequestBody MemberDTO dependentDto) {
        Member updated = memberService.updateDependent(id, dependentDto);
        return ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(updated)));
    }

    @DeleteMapping("/dependents/{id:\\d+}")
    public ResponseEntity<ApiResponse<Void>> deleteDependent(@PathVariable Long id) {
        memberService.deleteDependent(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Dependent deleted"));
    }

    @DeleteMapping("/{id:\\d+}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Void>> deleteMember(@PathVariable Long id) {
        memberService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Member deleted successfully"));
    }

    @GetMapping("/pending-welcomes")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Page<MemberDTO>>> getPendingWelcomes(Pageable pageable) {
        Page<Member> members = memberService.findPendingWelcomes(pageable);
        Page<MemberDTO> dtos = members.map(MemberDTO::fromEntity);
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    @PostMapping("/{id:\\d+}/mark-welcomed")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<MemberDTO>> markWelcomed(
            @PathVariable Long id,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Long welcomedByMemberId = userDetails != null ? userDetails.getMemberId() : null;
        Member member = memberService.markWelcomed(id, welcomedByMemberId);
        return ResponseEntity.ok(ApiResponse.success(MemberDTO.fromEntity(member), "Member marked as welcomed"));
    }

    private final church.abunearegawi.backend.service.TransactionService transactionService;

    @GetMapping("/{id:\\d+}/contributions")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER') or #id == authentication.principal.memberId")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getMemberContributions(@PathVariable Long id) {
        return memberService.findById(id)
                .map(member -> {
                    java.util.List<church.abunearegawi.backend.dto.TransactionDTO> contributions = transactionService
                            .findByMember(id);

                    java.util.Map<String, Object> response = new java.util.HashMap<>();
                    response.put("member", java.util.Map.of(
                            "id", member.getId(),
                            "firstName", member.getFirstName(),
                            "lastName", member.getLastName()));
                    response.put("contributions", contributions);

                    return ResponseEntity.ok(ApiResponse.success(response));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/dependents/{dependentId:\\d+}/promote")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<MemberDTO>> promoteDependent(
            @PathVariable Long dependentId,
            @RequestBody(required = false) java.util.Map<String, String> request) {
        String email = request != null ? request.get("email") : null;
        String phone = request != null ? request.get("phone") : null;
        Member promoted = memberService.promoteDependent(dependentId, email, phone);
        return ResponseEntity
                .ok(ApiResponse.success(MemberDTO.fromEntity(promoted), "Dependent promoted to member successfully"));
    }

    @GetMapping("/validate-family-head/{phoneNumber}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> validateHeadOfHouseholdPhone(
            @PathVariable String phoneNumber) {
        return ResponseEntity.ok(ApiResponse.success(memberService.validateHeadOfHousehold(phoneNumber)));
    }

    @GetMapping("/registration-status")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> checkRegistrationStatus(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String firebaseUid) {
        if (email == null && firebaseUid == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Either email or firebaseUid is required"));
        }
        return ResponseEntity.ok(ApiResponse.success(memberService.checkRegistrationStatus(email, firebaseUid)));
    }
}
