package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.LedgerEntry;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.ExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP', 'SECRETARY', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<Page<LedgerEntry>>> getExpenses(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String glCode,
            @RequestParam(required = false) String paymentMethod,
            Pageable pageable) {
        Page<LedgerEntry> expenses = expenseService.findExpenses(startDate, endDate, glCode, paymentMethod, pageable);
        return ResponseEntity.ok(ApiResponse.success(expenses));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<LedgerEntry>> createExpense(
            @RequestBody LedgerEntry expense,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Long collectedByMemberId = userDetails != null ? userDetails.getMemberId() : null;
        LedgerEntry created = expenseService.createExpense(expense, collectedByMemberId);
        return ResponseEntity.created(URI.create("/api/expenses/" + created.getId()))
                .body(ApiResponse.success(created, "Expense recorded successfully"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'CHURCH_LEADERSHIP', 'SECRETARY', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<LedgerEntry>> getExpenseById(@PathVariable Long id) {
        return expenseService.findById(id)
                .map(expense -> ResponseEntity.ok(ApiResponse.success(expense)))
                .orElse(ResponseEntity.notFound().build());
    }
}
