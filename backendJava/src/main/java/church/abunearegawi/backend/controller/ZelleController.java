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
        Long memberId = request.get("member_id") != null ?
                Long.parseLong(request.get("member_id").toString()) : null;
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

    // TODO: Implement Gmail sync functionality
    // @PostMapping("/sync/gmail")
    // @PostMapping("/preview/gmail")
}

