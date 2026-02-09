package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;

import church.abunearegawi.backend.dto.TransactionDTO;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.ReportService;
import church.abunearegawi.backend.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final ReportService reportService;
    private final TransactionService transactionService;



    @GetMapping("/weekly-report")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWeeklyReport(
            @RequestParam(name = "week_start", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        if (weekStart == null) {
            weekStart = LocalDate.now();
        }
        return ResponseEntity.ok(ApiResponse.success(reportService.getWeeklyReport(weekStart)));
    }

    // Legacy endpoint for AddPaymentModal ("old" view)
    // Matches: /api/payments/${selectedMemberId}/payment
    @PostMapping("/{memberId}/payment")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<TransactionDTO>> recordPayment(
            @PathVariable Long memberId,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {

        // Map payload to TransactionCreateRequest or create manually
        Transaction transaction = new Transaction();
        transaction.setMember(new Member());
        transaction.getMember().setId(memberId);

        if (payload.containsKey("amount")) {
            transaction.setAmount(new java.math.BigDecimal(payload.get("amount").toString()));
        }
        if (payload.containsKey("paymentMethod")) {
            try {
                // Ensure lowercase for enum mapping
                String methodStr = payload.get("paymentMethod").toString().toLowerCase();
                transaction.setPaymentMethod(Transaction.PaymentMethod.valueOf(methodStr));
            } catch (IllegalArgumentException e) {
                // Default or handle error? fallback to cash? or 'other'
                transaction.setPaymentMethod(Transaction.PaymentMethod.other);
            }
        }
        if (payload.containsKey("notes")) {
            transaction.setNote(payload.get("notes").toString());
        }
        transaction.setPaymentDate(LocalDate.now()); // Default to today
        transaction.setPaymentType(Transaction.PaymentType.membership_due); // Default legacy calls to membership_due

        if (userDetails != null) {
            Member collector = new Member();
            collector.setId(userDetails.getMemberId());
            transaction.setCollector(collector);
        }

        TransactionDTO saved = transactionService.create(transaction);
        return ResponseEntity.created(URI.create("/api/transactions/" + saved.id()))
                .body(ApiResponse.success(saved));
    }
}
