package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.AnnouncementDTO;
import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping("/active")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AnnouncementDTO>>> getActive() {
        return ResponseEntity.ok(ApiResponse.success(announcementService.getActive()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<List<AnnouncementDTO>>> list(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(announcementService.list(status)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> create(@RequestBody Map<String, String> body) {
        AnnouncementDTO dto = announcementService.create(
            body.get("title"), body.get("description"),
            LocalDate.parse(body.get("start_date")), LocalDate.parse(body.get("end_date")),
            null
        );
        return ResponseEntity.status(201).body(ApiResponse.success(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> update(@PathVariable Long id, @RequestBody Map<String, String> body) {
        AnnouncementDTO dto = announcementService.update(
            id, body.get("title"), body.get("description"),
            LocalDate.parse(body.get("start_date")), LocalDate.parse(body.get("end_date"))
        );
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(announcementService.cancel(id)));
    }
}
