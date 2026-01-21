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
                SmsLog.RecipientType recipientType = request.get("recipient_type") != null
                                ? SmsLog.RecipientType.valueOf(request.get("recipient_type").toString().toUpperCase())
                                : SmsLog.RecipientType.INDIVIDUAL;
                Long recipientMemberId = request.get("recipient_member_id") != null
                                ? Long.parseLong(request.get("recipient_member_id").toString())
                                : null;
                Long groupId = request.get("group_id") != null ? Long.parseLong(request.get("group_id").toString())
                                : null;
                Long departmentId = request.get("department_id") != null
                                ? Long.parseLong(request.get("department_id").toString())
                                : null;
                Integer recipientCount = request.get("recipient_count") != null
                                ? Integer.parseInt(request.get("recipient_count").toString())
                                : 1;
                String message = request.get("message") != null ? request.get("message").toString() : "";
                SmsLog.Status status = request.get("status") != null
                                ? SmsLog.Status.valueOf(request.get("status").toString().toUpperCase())
                                : SmsLog.Status.SUCCESS;
                String error = request.get("error") != null ? request.get("error").toString() : null;

                SmsLog created = smsService.createSmsLog(senderId, role, recipientType, recipientMemberId,
                                groupId, departmentId, recipientCount, message, status, error);
                return ResponseEntity.ok(ApiResponse.success(created));
        }

        @PostMapping("/send/individual/{memberId}")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendIndividualSms(
                        @PathVariable Long memberId,
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {

                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }

                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                // If senderId is null (e.g. automated?), we should handle it. But auth is valid
                // here.
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }

                try {
                        SmsLog log = smsService.sendToMember(senderId, memberId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error("Failed to send SMS: " + e.getMessage()));
                }
        }

        @PostMapping("/send/group/{groupId}")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendGroupSms(
                        @PathVariable Long groupId,
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {
                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }
                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }
                try {
                        SmsLog log = smsService.sendToGroup(senderId, groupId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error("Failed to send group SMS: " + e.getMessage()));
                }
        }

        @PostMapping("/send/department/{departmentId}")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendDepartmentSms(
                        @PathVariable Long departmentId,
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {
                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }
                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }
                try {
                        SmsLog log = smsService.sendToDepartment(senderId, departmentId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error("Failed to send department SMS: " + e.getMessage()));
                }
        }

        @PostMapping("/send/all")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendAllSms(
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {
                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }
                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }
                try {
                        SmsLog log = smsService.sendToAll(senderId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error("Failed to send all SMS: " + e.getMessage()));
                }
        }

        @GetMapping("/groupRecipients/{groupId}")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getGroupRecipients(
                        @PathVariable Long groupId) {
                java.util.List<church.abunearegawi.backend.dto.MemberDTO> recipients = smsService
                                .getGroupRecipients(groupId);
                return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                                "recipients", recipients,
                                "totalCount", recipients.size())));
        }

        @GetMapping("/departmentRecipients/{departmentId}")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getDepartmentRecipients(
                        @PathVariable Long departmentId) {
                java.util.List<church.abunearegawi.backend.dto.MemberDTO> recipients = smsService
                                .getDepartmentRecipients(departmentId);
                return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                                "recipients", recipients,
                                "totalCount", recipients.size())));
        }

        @GetMapping("/allRecipients")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getAllRecipients() {
                java.util.List<church.abunearegawi.backend.dto.MemberDTO> recipients = smsService.getAllRecipients();
                return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                                "recipients", recipients,
                                "totalCount", recipients.size())));
        }

        @PostMapping("/sendPendingPledges")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendPendingPledges(
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {
                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }
                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }
                try {
                        SmsLog log = smsService.sendToPendingPledges(senderId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error(
                                                        "Failed to send pending pledges SMS: " + e.getMessage()));
                }
        }

        @PostMapping("/sendFulfilledPledges")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<SmsLog>> sendFulfilledPledges(
                        @RequestBody Map<String, String> request,
                        @AuthenticationPrincipal FirebaseUserDetails userDetails) {
                String message = request.get("message");
                if (message == null || message.isBlank()) {
                        return ResponseEntity.badRequest().body(ApiResponse.error("Message content is required"));
                }
                Long senderId = userDetails != null ? userDetails.getMemberId() : null;
                if (senderId == null) {
                        return ResponseEntity.status(401)
                                        .body(ApiResponse.error("Authenticated user member ID not found"));
                }
                try {
                        SmsLog log = smsService.sendToFulfilledPledges(senderId, message);
                        return ResponseEntity.ok(ApiResponse.success(log));
                } catch (Exception e) {
                        return ResponseEntity.status(500)
                                        .body(ApiResponse.error(
                                                        "Failed to send fulfilled pledges SMS: " + e.getMessage()));
                }
        }

        @GetMapping("/pendingPledgesRecipients")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getPendingPledgesRecipients() {
                java.util.List<church.abunearegawi.backend.dto.MemberDTO> recipients = smsService
                                .getPendingPledgesRecipients();
                return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                                "recipients", recipients,
                                "totalCount", recipients.size())));
        }

        @GetMapping("/fulfilledPledgesRecipients")
        @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'COMMUNICATIONS')")
        public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getFulfilledPledgesRecipients() {
                java.util.List<church.abunearegawi.backend.dto.MemberDTO> recipients = smsService
                                .getFulfilledPledgesRecipients();
                return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                                "recipients", recipients,
                                "totalCount", recipients.size())));
        }

        @GetMapping("/pricing")
        public ResponseEntity<Map<String, Object>> getSmsPricing() {
                return ResponseEntity.ok(Map.of("price", 0.0079, "currency", "USD"));
        }
}
