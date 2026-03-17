package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.StatementService;
import church.abunearegawi.backend.service.StatementService.StatementData;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Optional;

@RestController
@RequestMapping("/api/members/statement")
@RequiredArgsConstructor
public class StatementController {

    private final StatementService statementService;
    private final MemberRepository memberRepository;

    /**
     * GET /api/members/statement/pdf?year=YYYY
     * A member downloads their own annual contribution statement.
     */
    @GetMapping("/pdf")
    public ResponseEntity<byte[]> downloadStatement(
            @AuthenticationPrincipal FirebaseUserDetails userDetails,
            @RequestParam int year) {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!isYearValid(year)) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Member> memberOpt = memberRepository.findById(userDetails.getMemberId());
        if (memberOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        StatementData data = statementService.buildStatementData(memberOpt.get(), year);
        byte[] pdf = statementService.generatePdf(
                data.headOfHousehold(), data.transactions(), data.year());

        return buildPdfResponse(pdf, year);
    }

    /**
     * GET /api/members/statement/pdf/for-member?memberId=X&year=YYYY
     * Admin or Treasurer downloads a statement on behalf of any member.
     */
    @GetMapping("/pdf/for-member")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<byte[]> downloadStatementForMember(
            @RequestParam Long memberId,
            @RequestParam int year) {

        if (!isYearValid(year)) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Member> memberOpt = memberRepository.findById(memberId);
        if (memberOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        StatementData data = statementService.buildStatementData(memberOpt.get(), year);
        byte[] pdf = statementService.generatePdf(
                data.headOfHousehold(), data.transactions(), data.year());

        return buildPdfResponse(pdf, year);
    }

    // ── Private helpers ────────────────────────────────────────

    /**
     * Valid years: 2000 up to and including the year prior to the current year.
     */
    private boolean isYearValid(int year) {
        int currentYear = LocalDate.now().getYear();
        return year >= 2000 && year <= currentYear - 1;
    }

    private ResponseEntity<byte[]> buildPdfResponse(byte[] pdf, int year) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData(
                "attachment",
                "Annual_Contribution_Statement_" + year + ".pdf");
        headers.setContentLength(pdf.length);
        return new ResponseEntity<>(pdf, headers, HttpStatus.OK);
    }
}
