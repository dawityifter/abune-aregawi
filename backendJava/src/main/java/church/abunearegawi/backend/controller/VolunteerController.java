package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.VolunteerRequest;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.VolunteerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/volunteer-requests")
@RequiredArgsConstructor
public class VolunteerController {

    private final VolunteerService volunteerService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Page<VolunteerRequest>>> getVolunteerRequests(
            @RequestParam(required = false) VolunteerRequest.Status status,
            Pageable pageable) {
        Page<VolunteerRequest> requests = volunteerService.findAll(status, pageable);
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @GetMapping("/member/{memberId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP') or #memberId == authentication.principal.memberId")
    public ResponseEntity<ApiResponse<Page<VolunteerRequest>>> getVolunteerRequestsByMember(
            @PathVariable Long memberId,
            Pageable pageable) {
        Page<VolunteerRequest> requests = volunteerService.findByMemberId(memberId, pageable);
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<VolunteerRequest>> getVolunteerRequestById(@PathVariable Integer id) {
        return volunteerService.findById(id)
                .map(request -> ResponseEntity.ok(ApiResponse.success(request)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VolunteerRequest>> createVolunteerRequest(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Long memberId = userDetails != null ? userDetails.getMemberId() : null;
        if (memberId == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Member ID is required"));
        }

        String message = request.get("message") != null ? request.get("message").toString() : "";
        boolean agreedToContact = request.get("agreed_to_contact") != null ?
                Boolean.parseBoolean(request.get("agreed_to_contact").toString()) : false;

        VolunteerRequest created = volunteerService.create(memberId, message, agreedToContact);
        return ResponseEntity.created(URI.create("/api/volunteer-requests/" + created.getId()))
                .body(ApiResponse.success(created, "Volunteer request submitted successfully"));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<VolunteerRequest>> updateVolunteerRequestStatus(
            @PathVariable Integer id,
            @RequestBody Map<String, String> request) {
        String statusStr = request.get("status");
        if (statusStr == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Status is required"));
        }

        try {
            VolunteerRequest.Status status = VolunteerRequest.Status.valueOf(statusStr.toUpperCase());
            VolunteerRequest updated = volunteerService.updateStatus(id, status);
            return ResponseEntity.ok(ApiResponse.success(updated, "Volunteer request status updated successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid status. Must be one of: NEW, CONTACTED, ARCHIVED"));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteVolunteerRequest(@PathVariable Integer id) {
        volunteerService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Volunteer request deleted successfully"));
    }
}
