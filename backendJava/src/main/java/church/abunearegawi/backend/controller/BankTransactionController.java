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

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("transactions", page.getContent());

        java.util.Map<String, Object> pagination = new java.util.HashMap<>();
        pagination.put("total", page.getTotalElements());
        pagination.put("pages", page.getTotalPages());
        pagination.put("page", page.getNumber() + 1);
        response.put("pagination", pagination);

        // Optional: current_balance could be fetched from service if implemented
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
    public ResponseEntity<ApiResponse<Void>> reconcile(@RequestBody java.util.Map<String, Object> payload,
            @org.springframework.security.core.annotation.AuthenticationPrincipal church.abunearegawi.backend.security.FirebaseUserDetails userDetails) {
        Integer txId = (Integer) payload.get("transaction_id");
        Long memberId = payload.get("member_id") != null ? ((Number) payload.get("member_id")).longValue() : null;
        String type = (String) payload.get("payment_type");
        String manualDonor = (String) payload.get("manual_donor_name");
        String manualDonorType = (String) payload.get("manual_donor_type");
        Integer existingId = payload.get("existing_transaction_id") != null
                ? (Integer) payload.get("existing_transaction_id")
                : null;

        // Collector is the authenticated user
        church.abunearegawi.backend.model.Member collector = userDetails.getMember();

        bankTransactionService.reconcile(txId, memberId, type, manualDonor, manualDonorType, existingId, collector);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/reconcile/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'BOOKKEEPER')")
    public ResponseEntity<ApiResponse<Void>> batchReconcile(@RequestBody java.util.Map<String, Object> payload,
            @org.springframework.security.core.annotation.AuthenticationPrincipal church.abunearegawi.backend.security.FirebaseUserDetails userDetails) {
        // Expected payload: { "items": [ {transaction_id, member_id, payment_type,
        // manual_donor_name, ...}, ... ] }
        java.util.List<java.util.Map<String, Object>> items = (java.util.List<java.util.Map<String, Object>>) payload
                .get("items");
        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Items list is required"));
        }

        // Collector is the authenticated user
        church.abunearegawi.backend.model.Member collector = userDetails.getMember();

        bankTransactionService.batchReconcile(items, collector);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
