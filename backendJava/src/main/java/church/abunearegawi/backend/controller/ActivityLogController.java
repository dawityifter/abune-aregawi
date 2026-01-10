package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ActivityLogDTO;
import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/activity-logs")
@RequiredArgsConstructor
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getActivityLogs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        Page<ActivityLogDTO> logs = activityLogService.findAll(page, limit, userId, action, entityType, startDate,
                endDate);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("logs", logs.getContent());

        Map<String, Object> pagination = new HashMap<>();
        pagination.put("total", logs.getTotalElements());
        pagination.put("page", logs.getNumber() + 1); // Return 1-based page
        pagination.put("pages", logs.getTotalPages());

        responseData.put("pagination", pagination);

        return ResponseEntity.ok(ApiResponse.success(responseData));
    }
}
