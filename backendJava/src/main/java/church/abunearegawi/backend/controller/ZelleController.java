package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.service.ZelleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/zelle")
@RequiredArgsConstructor
public class ZelleController {

    private final ZelleService zelleService;

    @GetMapping("/memo-matches")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<List<ZelleMemoMatch>>> getAllMemoMatches() {
        List<ZelleMemoMatch> matches = zelleService.findAll();
        return ResponseEntity.ok(ApiResponse.success(matches));
    }

    @GetMapping("/memo-matches/member/{memberId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<List<ZelleMemoMatch>>> getMemoMatchesByMember(@PathVariable Long memberId) {
        List<ZelleMemoMatch> matches = zelleService.findByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.success(matches));
    }

    @GetMapping("/memo-matches/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<List<ZelleMemoMatch>>> searchMemoMatches(@RequestParam String memo) {
        List<ZelleMemoMatch> matches = zelleService.findByMemo(memo);
        return ResponseEntity.ok(ApiResponse.success(matches));
    }

    @PostMapping("/memo-matches")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<ZelleMemoMatch>> createMemoMatch(@RequestBody Map<String, Object> request) {
        Long memberId = request.get("member_id") != null ? Long.parseLong(request.get("member_id").toString()) : null;
        String firstName = request.get("first_name") != null ? request.get("first_name").toString() : null;
        String lastName = request.get("last_name") != null ? request.get("last_name").toString() : null;
        String memo = request.get("memo") != null ? request.get("memo").toString() : null;

        if (memberId == null || memo == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("member_id and memo are required"));
        }

        ZelleMemoMatch created = zelleService.create(memberId, firstName, lastName, memo);
        return ResponseEntity.created(URI.create("/api/zelle/memo-matches/" + created.getId()))
                .body(ApiResponse.success(created, "Zelle memo match created successfully"));
    }

    @DeleteMapping("/memo-matches/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteMemoMatch(@PathVariable UUID id) {
        zelleService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Zelle memo match deleted successfully"));
    }

    @GetMapping("/preview/gmail")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> previewGmail(
            @RequestParam(defaultValue = "5") int limit) {
        try {
            return ResponseEntity.ok(ApiResponse.success(zelleService.previewGmail(limit)));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("Failed to preview Zelle emails: " + e.getMessage()));
        }
    }

    @PostMapping("/reconcile/batch-create")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> batchCreate(
            @RequestBody Map<String, List<church.abunearegawi.backend.service.ZelleGmailService.ParsedZelle>> request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal church.abunearegawi.backend.security.FirebaseUserDetails userDetails) {
        try {
            List<church.abunearegawi.backend.service.ZelleGmailService.ParsedZelle> items = request.get("items");
            if (items == null) return ResponseEntity.badRequest().body(ApiResponse.error("Items list is required"));
            
            Long collectorId = userDetails != null ? userDetails.getMemberId() : null;
            if (collectorId == null) return ResponseEntity.status(401).body(ApiResponse.error("Collector ID not found"));

            List<church.abunearegawi.backend.model.Transaction> created = zelleService.batchCreate(items, collectorId);
            
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("success", true);
            response.put("createdCount", created.size());
            response.put("results", created);
            
            return ResponseEntity.ok(ApiResponse.success(response, "Batch transactions processed successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error("Failed to batch create transactions: " + e.getMessage()));
        }
    }
}
