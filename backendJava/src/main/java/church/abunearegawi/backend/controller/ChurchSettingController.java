package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.ChurchSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class ChurchSettingController {

    private final ChurchSettingService churchSettingService;

    @GetMapping("/tv-rotation-interval")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> get() {
        int seconds = churchSettingService.getTvRotationInterval();
        return ResponseEntity.ok(ApiResponse.success(Map.of("seconds", seconds)));
    }

    @PutMapping("/tv-rotation-interval")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> set(@RequestBody Map<String, Integer> body) {
        int seconds = churchSettingService.setTvRotationInterval(body.get("seconds"));
        return ResponseEntity.ok(ApiResponse.success(Map.of("seconds", seconds)));
    }
}
