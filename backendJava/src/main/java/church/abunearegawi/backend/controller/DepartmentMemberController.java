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
@RequestMapping("/api/departments/{departmentId}/members")
@RequiredArgsConstructor
public class DepartmentMemberController {

    private final DepartmentMemberService departmentMemberService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDepartmentMembers(
            @PathVariable Long departmentId,
            @RequestParam(required = false) DepartmentMember.Status status,
            @RequestParam(required = false) String role) {
        List<DepartmentMember> members = departmentMemberService.findByDepartmentId(departmentId, status, role);
        Map<String, Object> response = Map.of(
                "members", members,
                "count", members.size()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addMembersToDepartment(
            @PathVariable Long departmentId,
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Long> memberIds = request.get("member_ids") != null ?
                ((List<Number>) request.get("member_ids")).stream()
                        .map(Number::longValue)
                        .toList() : List.of();
        
        if (memberIds.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("member_ids array is required and cannot be empty"));
        }

        String roleInDepartment = request.get("role_in_department") != null ?
                request.get("role_in_department").toString() : "member";
        String notes = request.get("notes") != null ? request.get("notes").toString() : null;

        Map<String, Object> result = departmentMemberService.addMembersToDepartment(
                departmentId, memberIds, roleInDepartment, notes);
        
        return ResponseEntity.ok(ApiResponse.success(result, 
                "Added " + ((List<?>) result.get("added")).size() + " member(s) to department"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<DepartmentMember>> updateDepartmentMember(
            @PathVariable Long departmentId,
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        DepartmentMember.Status status = request.get("status") != null ?
                DepartmentMember.Status.valueOf(request.get("status").toString().toLowerCase()) : null;
        String roleInDepartment = request.get("role_in_department") != null ?
                request.get("role_in_department").toString() : null;
        String notes = request.get("notes") != null ? request.get("notes").toString() : null;

        DepartmentMember updated = departmentMemberService.update(id, status, roleInDepartment, notes);
        return ResponseEntity.ok(ApiResponse.success(updated, "Department member updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Void>> removeMemberFromDepartment(
            @PathVariable Long departmentId,
            @PathVariable Long id) {
        departmentMemberService.removeFromDepartment(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Member removed from department successfully"));
    }
}

