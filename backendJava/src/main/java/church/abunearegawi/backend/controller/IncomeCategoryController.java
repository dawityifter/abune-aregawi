package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.IncomeCategory;
import church.abunearegawi.backend.service.IncomeCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/income-categories")
@RequiredArgsConstructor
public class IncomeCategoryController {

    private final IncomeCategoryService incomeCategoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<IncomeCategory>>> getAllIncomeCategories(
            @RequestParam(name = "active_only", defaultValue = "true") boolean activeOnly) {
        List<IncomeCategory> categories = incomeCategoryService.findAll(activeOnly);
        return ResponseEntity.ok(ApiResponse.success(categories));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IncomeCategory>> getIncomeCategoryById(@PathVariable Long id) {
        return incomeCategoryService.findById(id)
                .map(category -> ResponseEntity.ok(ApiResponse.success(category)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/gl-code/{glCode}")
    public ResponseEntity<ApiResponse<IncomeCategory>> getIncomeCategoryByGLCode(@PathVariable String glCode) {
        return incomeCategoryService.findByGlCode(glCode)
                .map(category -> ResponseEntity.ok(ApiResponse.success(category)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<IncomeCategory>> createIncomeCategory(@RequestBody IncomeCategory category) {
        IncomeCategory created = incomeCategoryService.create(category);
        return ResponseEntity.created(URI.create("/api/income-categories/" + created.getId()))
                .body(ApiResponse.success(created, "Income category created successfully"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<IncomeCategory>> updateIncomeCategory(
            @PathVariable Long id,
            @RequestBody IncomeCategory category) {
        IncomeCategory updated = incomeCategoryService.update(id, category);
        return ResponseEntity.ok(ApiResponse.success(updated, "Income category updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteIncomeCategory(@PathVariable Long id) {
        incomeCategoryService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Income category deactivated successfully"));
    }
}

