package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.DepartmentMember;
import church.abunearegawi.backend.service.DepartmentMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/members/{memberId}/departments")
@RequiredArgsConstructor
public class MemberDepartmentController {

    private final DepartmentMemberService departmentMemberService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP', 'MEMBER') or #memberId == authentication.principal.memberId")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMemberDepartments(
            @PathVariable Long memberId,
            @RequestParam(required = false) DepartmentMember.Status status) {
        List<church.abunearegawi.backend.dto.DepartmentMemberDTO> memberships = departmentMemberService
                .findByMemberId(memberId);

        // Filter by status if provided
        if (status != null) {
            memberships = memberships.stream()
                    .filter(m -> m.status() != null && m.status().equalsIgnoreCase(status.name()))
                    .toList();
        }

        Map<String, Object> response = Map.of(
                "departments", memberships,
                "count", memberships.size());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
