package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.dto.ExpenseCreateRequest;
import church.abunearegawi.backend.dto.ExpenseDTO;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.ExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;
    private final church.abunearegawi.backend.service.ExpenseCategoryService expenseCategoryService;

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<java.util.List<church.abunearegawi.backend.model.ExpenseCategory>>> getExpenseCategories(
            @RequestParam(name = "include_inactive", defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(ApiResponse.success(expenseCategoryService.findAll(includeInactive)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP', 'SECRETARY', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getExpenses(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String glCode,
            @RequestParam(required = false) String paymentMethod,
            Pageable pageable) {
        Map<String, Object> result = expenseService.findExpenses(startDate, endDate, glCode, paymentMethod, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<ExpenseDTO>> createExpense(
            @RequestBody ExpenseCreateRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Long collectedByMemberId = userDetails != null ? userDetails.getMemberId() : null;
        ExpenseDTO created = expenseService.createExpense(request, collectedByMemberId);
        return ResponseEntity.created(URI.create("/api/expenses/" + created.id()))
                .body(ApiResponse.success(created, "Expense recorded successfully"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP', 'SECRETARY', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<ExpenseDTO>> getExpenseById(@PathVariable Long id) {
        return expenseService.findById(id)
                .map(expense -> ResponseEntity.ok(ApiResponse.success(expense)))
                .orElse(ResponseEntity.notFound().build());
    }
}
