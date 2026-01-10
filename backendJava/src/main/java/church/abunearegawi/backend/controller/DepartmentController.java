package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.dto.DepartmentCreateRequest;
import church.abunearegawi.backend.dto.DepartmentDTO;
import church.abunearegawi.backend.dto.DepartmentUpdateRequest;
import church.abunearegawi.backend.model.Department;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.service.DepartmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentService departmentService;

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getAllDepartments(
            @RequestParam(required = false, defaultValue = "true") boolean activeOnly,
            Pageable pageable) {
        Page<DepartmentDTO> page = departmentService.findAll(pageable);
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("departments", page.getContent());
        response.put("page", page);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/members/{memberId}/departments")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getMemberDepartments(
            @PathVariable Long memberId) {
        java.util.List<DepartmentDTO> depts = departmentService.getDepartmentsByMember(memberId);
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("departments", depts)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getDepartment(@PathVariable Long id) {
        try {
            DepartmentDTO dto = departmentService.findById(id);
            return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("department", dto)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/meetings")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getDepartmentMeetings(@PathVariable Long id) {
        java.util.List<church.abunearegawi.backend.dto.DepartmentMeetingDTO> meetings = departmentService
                .getMeetings(id);
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("meetings", meetings)));
    }

    @GetMapping("/{id}/tasks")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getDepartmentTasks(@PathVariable Long id) {
        java.util.List<church.abunearegawi.backend.dto.DepartmentTaskDTO> tasks = departmentService.getTasks(id);
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("tasks", tasks)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DepartmentDTO>> createDepartment(
            @Valid @RequestBody DepartmentCreateRequest request) {
        Department department = new Department();
        department.setName(request.getName());
        department.setDescription(request.getDescription());
        department.setType(request.getType() != null ? request.getType() : "ministry");
        department.setContactEmail(request.getContactEmail());
        department.setContactPhone(request.getContactPhone());
        department.setMeetingSchedule(request.getMeetingSchedule());
        department.setPublic(request.isPublic());
        department.setMaxMembers(request.getMaxMembers());
        department.setSortOrder(request.getSortOrder());

        if (request.getParentDepartmentId() != null) {
            Department parent = new Department();
            parent.setId(request.getParentDepartmentId());
            department.setParentDepartment(parent);
        }

        if (request.getLeaderId() != null) {
            Member leader = new Member();
            leader.setId(request.getLeaderId());
            department.setLeader(leader);
        }

        DepartmentDTO saved = departmentService.create(department);
        return ResponseEntity.created(URI.create("/api/departments/" + saved.id()))
                .body(ApiResponse.success(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DepartmentDTO>> updateDepartment(
            @PathVariable Long id,
            @RequestBody DepartmentUpdateRequest request) {

        Department department = new Department();
        // Only map non-nulls or let the service handle partial updates?
        // Service update logic in Step 4262 was simplistic (overwrote fields).
        // Let's assume we map explicitly here
        department.setName(request.getName());
        department.setDescription(request.getDescription());
        department.setType(request.getType());
        department.setContactEmail(request.getContactEmail());
        department.setContactPhone(request.getContactPhone());
        department.setMeetingSchedule(request.getMeetingSchedule());
        if (request.getIsActive() != null)
            department.setActive(request.getIsActive());
        if (request.getIsPublic() != null)
            department.setPublic(request.getIsPublic());
        department.setMaxMembers(request.getMaxMembers());
        department.setSortOrder(request.getSortOrder());

        if (request.getLeaderId() != null) {
            Member leader = new Member();
            leader.setId(request.getLeaderId());
            department.setLeader(leader);
        }

        DepartmentDTO updated = departmentService.update(id, department);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }
}
