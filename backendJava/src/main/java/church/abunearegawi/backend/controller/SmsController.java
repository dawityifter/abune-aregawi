package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.SmsLog;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.SmsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sms")
@RequiredArgsConstructor
public class SmsController {

    private final SmsService smsService;

    @GetMapping("/logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Page<SmsLog>>> getSmsLogs(Pageable pageable) {
        Page<SmsLog> logs = smsService.findAll(pageable);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/logs/sender/{senderId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP') or #senderId == authentication.principal.memberId")
    public ResponseEntity<ApiResponse<Page<SmsLog>>> getSmsLogsBySender(
            @PathVariable Long senderId,
            Pageable pageable) {
        Page<SmsLog> logs = smsService.findBySenderId(senderId, pageable);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/logs/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<SmsLog>> getSmsLogById(@PathVariable Long id) {
        return smsService.findById(id)
                .map(log -> ResponseEntity.ok(ApiResponse.success(log)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<SmsLog>> createSmsLog(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Long senderId = userDetails != null ? userDetails.getMemberId() : null;
        if (senderId == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Sender ID is required"));
        }

        String role = request.get("role") != null ? request.get("role").toString() : "unknown";
        SmsLog.RecipientType recipientType = request.get("recipient_type") != null ?
                SmsLog.RecipientType.valueOf(request.get("recipient_type").toString().toUpperCase()) :
                SmsLog.RecipientType.INDIVIDUAL;
        Long recipientMemberId = request.get("recipient_member_id") != null ?
                Long.parseLong(request.get("recipient_member_id").toString()) : null;
        Long groupId = request.get("group_id") != null ?
                Long.parseLong(request.get("group_id").toString()) : null;
        Long departmentId = request.get("department_id") != null ?
                Long.parseLong(request.get("department_id").toString()) : null;
        Integer recipientCount = request.get("recipient_count") != null ?
                Integer.parseInt(request.get("recipient_count").toString()) : 1;
        String message = request.get("message") != null ? request.get("message").toString() : "";
        SmsLog.Status status = request.get("status") != null ?
                SmsLog.Status.valueOf(request.get("status").toString().toUpperCase()) :
                SmsLog.Status.SUCCESS;
        String error = request.get("error") != null ? request.get("error").toString() : null;

        SmsLog created = smsService.createSmsLog(senderId, role, recipientType, recipientMemberId,
                groupId, departmentId, recipientCount, message, status, error);
        return ResponseEntity.ok(ApiResponse.success(created));
    }

    // TODO: Implement actual SMS sending with Twilio integration
    // @PostMapping("/send/individual/{memberId}")
    // @PostMapping("/send/group/{groupId}")
    // @PostMapping("/send/department/{departmentId}")
    // @PostMapping("/send/all")
}

