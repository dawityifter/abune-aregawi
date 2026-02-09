package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.Employee;
import church.abunearegawi.backend.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<List<Employee>>> getAllEmployees(
            @RequestParam(name = "is_active", required = false) Boolean isActive) {
        return ResponseEntity.ok(ApiResponse.success(employeeService.findAll(isActive)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Employee>> getEmployeeById(@PathVariable UUID id) {
        return employeeService.findById(id)
                .map(emp -> ResponseEntity.ok(ApiResponse.success(emp)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<Employee>> createEmployee(@RequestBody Employee employee) {
        Employee created = employeeService.create(employee);
        return ResponseEntity.created(URI.create("/api/employees/" + created.getId()))
                .body(ApiResponse.success(created, "Employee created successfully"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<Employee>> updateEmployee(
            @PathVariable UUID id,
            @RequestBody Employee employee) {
        Employee updated = employeeService.update(id, employee);
        return ResponseEntity.ok(ApiResponse.success(updated, "Employee updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEmployee(@PathVariable UUID id) {
        employeeService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Employee deleted successfully"));
    }
}
