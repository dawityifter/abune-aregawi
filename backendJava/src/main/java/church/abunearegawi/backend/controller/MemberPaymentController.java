package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.dto.MemberPaymentDTO;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.MemberPaymentService;
// cleaned up
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/members/dues")
@RequiredArgsConstructor
public class MemberPaymentController {

    private final MemberPaymentService memberPaymentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY', 'CHURCH_LEADERSHIP', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AR_TEAM')")
    public ResponseEntity<ApiResponse<Page<MemberPaymentDTO>>> getAllPayments(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(memberPaymentService.findAll(pageable)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<church.abunearegawi.backend.dto.DuesDetailsDTO>> getMyStatus(
            @AuthenticationPrincipal FirebaseUserDetails userDetails,
            @RequestParam(defaultValue = "2024") Integer year) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }

        // We use userDetails.getMemberId()
        // But we need to ensure the member exists
        return ResponseEntity.ok(ApiResponse.success(
                memberPaymentService.getDuesDetails(userDetails.getMemberId(), year)));
    }

    @GetMapping("/by-member/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY', 'CHURCH_LEADERSHIP', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AR_TEAM') or #id == authentication.principal.memberId or @securityService.isHeadOfHousehold(authentication.principal.memberId, #id)")
    public ResponseEntity<ApiResponse<church.abunearegawi.backend.dto.DuesDetailsDTO>> getDuesByMember(
            @PathVariable Long id,
            @RequestParam(defaultValue = "2024") Integer year) {
        return ResponseEntity.ok(ApiResponse.success(
                memberPaymentService.getDuesDetails(id, year)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY', 'CHURCH_LEADERSHIP', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AR_TEAM')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary(
            @RequestParam(defaultValue = "2024") Integer year) {
        // Implement summary logic: Total collected for the year
        // We'll rely on service aggregation or manual sum for now
        // The service logic we have: getTotalPaidByMemberAndYear (for specific member)
        // We added sumPaidByYear sum in repository - verify service has it? repository
        // has it.
        // Let's assume we can add it to service or use repo if service exposes it.
        // Actually, Step 4313 added `findByYear(Integer year)`.

        List<MemberPaymentDTO> payments = memberPaymentService.findByYear(year);
        // Sum totalCollected
        java.math.BigDecimal total = payments.stream()
                .map(MemberPaymentDTO::totalCollected)
                .filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "year", year,
                "totalCollected", total,
                "count", payments.size())));
    }
}
