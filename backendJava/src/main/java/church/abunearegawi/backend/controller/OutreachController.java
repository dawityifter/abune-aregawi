package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.Outreach;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.OutreachService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/members/{memberId}/outreach")
@RequiredArgsConstructor
public class OutreachController {

    private final OutreachService outreachService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<List<Outreach>>> listOutreach(@PathVariable Long memberId) {
        List<Outreach> notes = outreachService.findByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.success(notes));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Outreach>> createOutreach(
            @PathVariable Long memberId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        String note = request.get("note");
        String welcomedBy = userDetails != null ? 
            (userDetails.getMemberId() != null ? userDetails.getMemberId().toString() : 
             (userDetails.getEmail() != null ? userDetails.getEmail() : "unknown")) : 
            "unknown";
        
        Outreach created = outreachService.create(memberId, note, welcomedBy);
        return ResponseEntity.created(URI.create("/api/members/" + memberId + "/outreach/" + created.getId()))
                .body(ApiResponse.success(created));
    }
}

