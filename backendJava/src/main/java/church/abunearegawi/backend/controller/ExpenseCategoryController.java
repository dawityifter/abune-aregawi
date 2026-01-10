package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.ExpenseCategory;
import church.abunearegawi.backend.service.ExpenseCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expense-categories")
@RequiredArgsConstructor
public class ExpenseCategoryController {

    private final ExpenseCategoryService expenseCategoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExpenseCategory>>> getExpenseCategories(
            @RequestParam(name = "include_inactive", defaultValue = "false") boolean includeInactive) {
        List<ExpenseCategory> categories = expenseCategoryService.findAll(includeInactive);
        return ResponseEntity.ok(ApiResponse.success(categories));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExpenseCategory>> getExpenseCategoryById(@PathVariable java.util.UUID id) {
        return expenseCategoryService.findById(id)
                .map(category -> ResponseEntity.ok(ApiResponse.success(category)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/gl-code/{glCode}")
    public ResponseEntity<ApiResponse<ExpenseCategory>> getExpenseCategoryByGLCode(@PathVariable String glCode) {
        return expenseCategoryService.findByGlCode(glCode)
                .map(category -> ResponseEntity.ok(ApiResponse.success(category)))
                .orElse(ResponseEntity.notFound().build());
    }
}

