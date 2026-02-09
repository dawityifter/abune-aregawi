package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.BankTransaction;
import church.abunearegawi.backend.service.BankTransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/bank")
@RequiredArgsConstructor
public class BankTransactionController {

    private final BankTransactionService bankTransactionService;

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AR_TEAM', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getBankTransactions(
            @RequestParam(required = false) BankTransaction.Status status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String description,
            Pageable pageable) {
        Page<BankTransaction> page = bankTransactionService.findAll(status, type, startDate, endDate,
                description, pageable);

        // Enrich PENDING transactions with suggested_match and potential_matches
        java.util.List<java.util.Map<String, Object>> enrichedTransactions =
                bankTransactionService.enrichTransactions(page.getContent());

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("transactions", enrichedTransactions);

        java.util.Map<String, Object> pagination = new java.util.HashMap<>();
        pagination.put("total", page.getTotalElements());
        pagination.put("pages", page.getTotalPages());
        pagination.put("page", page.getNumber() + 1);
        response.put("pagination", pagination);

        response.put("current_balance", bankTransactionService.getCurrentBalance());

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/transactions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER', 'BUDGET_COMMITTEE', 'AUDITOR', 'AR_TEAM', 'AP_TEAM')")
    public ResponseEntity<ApiResponse<BankTransaction>> getBankTransactionById(@PathVariable Integer id) {
        return bankTransactionService.findById(id)
                .map(transaction -> ResponseEntity.ok(ApiResponse.success(transaction)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    public ResponseEntity<ApiResponse<BankTransaction>> createBankTransaction(
            @RequestBody BankTransaction transaction) {
        BankTransaction created = bankTransactionService.create(transaction);
        return ResponseEntity.created(URI.create("/api/bank/transactions/" + created.getId()))
                .body(ApiResponse.success(created, "Bank transaction created successfully"));
    }

    @PutMapping("/transactions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    public ResponseEntity<ApiResponse<BankTransaction>> updateBankTransaction(
            @PathVariable Integer id,
            @RequestBody BankTransaction transaction) {
        BankTransaction updated = bankTransactionService.update(id, transaction);
        return ResponseEntity.ok(ApiResponse.success(updated, "Bank transaction updated successfully"));
    }

    @DeleteMapping("/transactions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteBankTransaction(@PathVariable Integer id) {
        bankTransactionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Bank transaction deleted successfully"));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> uploadBankStatement(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        java.util.Map<String, Object> result = bankTransactionService.processUpload(file);
        return ResponseEntity.ok(ApiResponse.success(result, "File processed successfully"));
    }

    @PostMapping("/reconcile")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> reconcile(@RequestBody java.util.Map<String, Object> payload,
            @org.springframework.security.core.annotation.AuthenticationPrincipal church.abunearegawi.backend.security.FirebaseUserDetails userDetails) {
        Integer txId = payload.get("transaction_id") != null ? ((Number) payload.get("transaction_id")).intValue() : null;
        Long memberId = payload.get("member_id") != null ? ((Number) payload.get("member_id")).longValue() : null;
        String type = (String) payload.get("payment_type");
        String action = (String) payload.get("action");
        String manualDonor = (String) payload.get("manual_donor_name");
        String manualDonorType = (String) payload.get("manual_donor_type");
        Integer existingId = payload.get("existing_transaction_id") != null
                ? ((Number) payload.get("existing_transaction_id")).intValue()
                : null;
        Integer forYear = payload.get("for_year") != null ? ((Number) payload.get("for_year")).intValue() : null;

        // Collector is the authenticated user
        church.abunearegawi.backend.model.Member collector = userDetails.getMember();

        java.util.Map<String, Object> result = bankTransactionService.reconcile(
                txId, memberId, type, action, manualDonor, manualDonorType, existingId, forYear, collector);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/reconcile-bulk")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> batchReconcile(@RequestBody java.util.Map<String, Object> payload,
            @org.springframework.security.core.annotation.AuthenticationPrincipal church.abunearegawi.backend.security.FirebaseUserDetails userDetails) {
        // Node.js format: { transaction_ids: [1,2,3], member_id, payment_type, for_year }
        java.util.List<Number> transactionIds = (java.util.List<Number>) payload.get("transaction_ids");
        if (transactionIds == null || transactionIds.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("transaction_ids list is required"));
        }

        Long memberId = payload.get("member_id") != null ? ((Number) payload.get("member_id")).longValue() : null;
        String paymentType = (String) payload.get("payment_type");
        Integer forYear = payload.get("for_year") != null ? ((Number) payload.get("for_year")).intValue() : null;

        church.abunearegawi.backend.model.Member collector = userDetails.getMember();

        java.util.Map<String, Object> result = bankTransactionService.batchReconcile(
                transactionIds, memberId, paymentType, forYear, collector);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
