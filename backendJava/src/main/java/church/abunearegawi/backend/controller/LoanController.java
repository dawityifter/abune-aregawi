package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLoanStats() {
        return ResponseEntity.ok(ApiResponse.success(loanService.getLoanStats()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLoans(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(required = false) String status,
            @RequestParam(name = "member_id", required = false) Long memberId,
            @RequestParam(name = "start_date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(name = "end_date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.success(loanService.getLoans(page, size, status, memberId, startDate, endDate)));
    }

    @GetMapping("/{id}/receipt")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<byte[]> getLoanReceipt(@PathVariable Long id) {
        byte[] pdf = loanService.buildReceiptPdf(id);
        String filename = loanService.buildReceiptFilename(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLoanById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(loanService.getLoanById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createLoan(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        Map<String, Object> result = loanService.createLoan(payload, userDetails != null ? userDetails.getMember() : null);
        Object loanId = ((Map<?, ?>) result.get("loan")).get("id");
        return ResponseEntity.created(URI.create("/api/loans/" + loanId))
                .body(ApiResponse.success(result));
    }

    @PostMapping("/{id}/repayments")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> recordRepayment(
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success(
                loanService.recordRepayment(id, payload, userDetails != null ? userDetails.getMember() : null)));
    }
}
