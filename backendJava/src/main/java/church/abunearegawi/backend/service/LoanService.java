package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.LedgerEntry;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.MemberLoan;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.exception.BadRequestException;
import church.abunearegawi.backend.exception.ConflictException;
import church.abunearegawi.backend.exception.NotFoundException;
import church.abunearegawi.backend.repository.MemberLoanRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.TransactionRepository;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.awt.Color;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LoanService {

    private static final List<String> VALID_PAYMENT_METHODS = List.of("cash", "check", "zelle", "other");

    private final MemberLoanRepository memberLoanRepository;
    private final MemberRepository memberRepository;
    private final TransactionRepository transactionRepository;
    private final church.abunearegawi.backend.repository.LedgerEntryRepository ledgerEntryRepository;

    @Transactional
    public Map<String, Object> createLoan(Map<String, Object> payload, Member collector) {
        if (collector == null) {
            throw new BadRequestException("User authentication required");
        }

        Long memberId = longValue(payload.get("member_id"));
        BigDecimal amount = decimalValue(payload.get("amount"));
        String paymentMethod = stringValue(payload.get("payment_method"));
        String receiptNumber = stringValue(payload.get("receipt_number"));
        LocalDate loanDate = localDateValue(payload.get("loan_date"));
        String notes = stringValue(payload.get("notes"));

        if (memberId == null || amount == null || paymentMethod == null || loanDate == null) {
            throw new BadRequestException("Missing required fields: member_id, amount, payment_method, loan_date");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Amount must be a positive number");
        }

        paymentMethod = paymentMethod.toLowerCase();
        validatePaymentMethod(paymentMethod);
        validateReceiptRequirement(paymentMethod, receiptNumber);
        validateReceiptUniqueness(receiptNumber);

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found"));

        Transaction transaction = Transaction.builder()
                .member(member)
                .collector(collector)
                .paymentDate(loanDate)
                .amount(amount)
                .paymentType(Transaction.PaymentType.loan_received)
                .paymentMethod(Transaction.PaymentMethod.valueOf(paymentMethod))
                .status(Transaction.Status.succeeded)
                .receiptNumber(emptyToNull(receiptNumber))
                .note(emptyToNull(notes))
                .build();
        Transaction savedTransaction = transactionRepository.save(transaction);

        LedgerEntry ledgerEntry = LedgerEntry.builder()
                .transaction(savedTransaction)
                .member(member)
                .collector(collector)
                .entryDate(loanDate)
                .type("loan_received")
                .category("LIA001")
                .amount(amount)
                .paymentMethod(paymentMethod)
                .receiptNumber(emptyToNull(receiptNumber))
                .memo("Loan received from " + member.getFirstName() + " " + member.getLastName())
                .sourceSystem("manual")
                .build();
        ledgerEntryRepository.save(ledgerEntry);

        MemberLoan loan = MemberLoan.builder()
                .member(member)
                .transaction(savedTransaction)
                .amount(amount)
                .outstandingBalance(amount)
                .paymentMethod(paymentMethod)
                .receiptNumber(emptyToNull(receiptNumber))
                .loanDate(loanDate)
                .status(MemberLoan.Status.ACTIVE)
                .notes(emptyToNull(notes))
                .collector(collector)
                .build();
        MemberLoan savedLoan = memberLoanRepository.save(loan);

        return Map.of(
                "loan", toLoanMap(savedLoan),
                "transaction", toTransactionMap(savedTransaction));
    }

    @Transactional
    public Map<String, Object> recordRepayment(Long loanId, Map<String, Object> payload, Member collector) {
        if (collector == null) {
            throw new BadRequestException("User authentication required");
        }

        MemberLoan loan = memberLoanRepository.findById(loanId)
                .orElseThrow(() -> new NotFoundException("Loan not found"));
        if (loan.getStatus() == MemberLoan.Status.CLOSED) {
            throw new ConflictException("Cannot record repayment on a closed loan");
        }

        BigDecimal repaymentAmount = decimalValue(payload.get("repayment_amount"));
        String paymentMethod = stringValue(payload.get("payment_method"));
        String receiptNumber = stringValue(payload.get("receipt_number"));
        LocalDate repaymentDate = Optional.ofNullable(localDateValue(payload.get("repayment_date"))).orElse(LocalDate.now());
        String notes = stringValue(payload.get("notes"));

        if (repaymentAmount == null || repaymentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Repayment amount must be a positive number");
        }
        if (paymentMethod == null) {
            throw new BadRequestException("Payment method must be one of: cash, check, zelle, other");
        }

        paymentMethod = paymentMethod.toLowerCase();
        validatePaymentMethod(paymentMethod);
        validateReceiptRequirement(paymentMethod, receiptNumber);
        validateReceiptUniqueness(receiptNumber);

        if (repaymentAmount.compareTo(loan.getOutstandingBalance()) > 0) {
            throw new BadRequestException(
                    "Repayment amount ($" + repaymentAmount + ") exceeds outstanding balance ($" + loan.getOutstandingBalance() + ")");
        }

        Transaction transaction = Transaction.builder()
                .member(loan.getMember())
                .collector(collector)
                .paymentDate(repaymentDate)
                .amount(repaymentAmount)
                .paymentType(Transaction.PaymentType.loan_repayment)
                .paymentMethod(Transaction.PaymentMethod.valueOf(paymentMethod))
                .status(Transaction.Status.succeeded)
                .receiptNumber(emptyToNull(receiptNumber))
                .note(emptyToNull(notes))
                .build();
        Transaction savedTransaction = transactionRepository.save(transaction);

        LedgerEntry ledgerEntry = LedgerEntry.builder()
                .transaction(savedTransaction)
                .member(loan.getMember())
                .collector(collector)
                .entryDate(repaymentDate)
                .type("loan_repayment")
                .category("LIA002")
                .amount(repaymentAmount)
                .paymentMethod(paymentMethod)
                .receiptNumber(emptyToNull(receiptNumber))
                .memo("Loan repayment for loan #" + loan.getId())
                .sourceSystem("manual")
                .build();
        ledgerEntryRepository.save(ledgerEntry);

        BigDecimal newBalance = loan.getOutstandingBalance().subtract(repaymentAmount).setScale(2, RoundingMode.HALF_UP);
        loan.setOutstandingBalance(newBalance);
        loan.setStatus(newBalance.compareTo(BigDecimal.ZERO) == 0
                ? MemberLoan.Status.CLOSED
                : MemberLoan.Status.PARTIALLY_REPAID);
        memberLoanRepository.save(loan);

        return Map.of(
                "loan", toLoanMap(loan),
                "transaction", toTransactionMap(savedTransaction));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLoans(Integer page, Integer size, String status, Long memberId,
                                        LocalDate startDate, LocalDate endDate) {
        int pageNum = page != null ? Math.max(0, page) : 0;
        int pageSize = size != null ? size : 20;
        MemberLoan.Status parsedStatus = parseStatus(status);

        Page<MemberLoan> loanPage = memberLoanRepository.findWithFilters(
                parsedStatus,
                memberId,
                startDate,
                endDate,
                PageRequest.of(pageNum, pageSize, Sort.by(Sort.Direction.DESC, "loanDate", "createdAt")));

        List<Map<String, Object>> loans = loanPage.getContent().stream().map(this::toLoanMap).toList();
        return Map.of(
                "loans", loans,
                "pagination", Map.of(
                        "current_page", pageNum,
                        "total_pages", loanPage.getTotalPages(),
                        "total_items", loanPage.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLoanById(Long id) {
        MemberLoan loan = memberLoanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Loan not found"));
        return toLoanMap(loan);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLoanStats() {
        List<MemberLoan.Status> openStatuses = List.of(MemberLoan.Status.ACTIVE, MemberLoan.Status.PARTIALLY_REPAID);
        BigDecimal outstanding = defaultZero(memberLoanRepository.sumOutstandingBalanceByStatuses(openStatuses));
        long activeLoansCount = memberLoanRepository.countByStatus(MemberLoan.Status.ACTIVE);
        long partiallyRepaidCount = memberLoanRepository.countByStatus(MemberLoan.Status.PARTIALLY_REPAID);
        long closedLoansCount = memberLoanRepository.countByStatus(MemberLoan.Status.CLOSED);
        BigDecimal totalLoanedAmount = defaultZero(memberLoanRepository.sumTotalLoanAmount());
        BigDecimal totalRepaidAmount = totalLoanedAmount.subtract(outstanding).setScale(2, RoundingMode.HALF_UP);
        long lendingMembersCount = memberLoanRepository.countDistinctMembersByStatusIn(openStatuses);

        List<Map<String, Object>> recentLoans = memberLoanRepository.findTop5ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toLoanMap)
                .toList();
        List<Map<String, Object>> recentRepayments = transactionRepository.findByPaymentType(Transaction.PaymentType.loan_repayment)
                .stream()
                .sorted((a, b) -> b.getPaymentDate().compareTo(a.getPaymentDate()))
                .limit(5)
                .map(this::toTransactionMap)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOutstandingBalance", outstanding);
        result.put("activeLoansCount", activeLoansCount);
        result.put("partiallyRepaidCount", partiallyRepaidCount);
        result.put("closedLoansCount", closedLoansCount);
        result.put("totalLoanedAmount", totalLoanedAmount);
        result.put("totalRepaidAmount", totalRepaidAmount);
        result.put("lendingMembersCount", lendingMembersCount);
        result.put("recentLoans", recentLoans);
        result.put("recentRepayments", recentRepayments);
        return result;
    }

    @Transactional(readOnly = true)
    public byte[] buildReceiptPdf(Long id) {
        MemberLoan loan = memberLoanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Loan not found"));
        return buildLoanReceiptPdf(loan);
    }

    @Transactional(readOnly = true)
    public String buildReceiptFilename(Long id) {
        MemberLoan loan = memberLoanRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Loan not found"));
        return "Loan_Receipt_" + loan.getId() + "_" + loan.getMember().getFirstName() + "_" + loan.getMember().getLastName() + ".pdf";
    }

    private Map<String, Object> toLoanMap(MemberLoan loan) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", loan.getId());
        result.put("transaction_id", loan.getTransaction() != null ? loan.getTransaction().getId() : null);
        result.put("member_id", loan.getMember() != null ? loan.getMember().getId() : null);
        result.put("amount", loan.getAmount());
        result.put("outstanding_balance", loan.getOutstandingBalance());
        result.put("payment_method", loan.getPaymentMethod());
        result.put("receipt_number", loan.getReceiptNumber());
        result.put("loan_date", loan.getLoanDate());
        result.put("status", loan.getStatus() != null ? loan.getStatus().name() : null);
        result.put("notes", loan.getNotes());
        result.put("collected_by", loan.getCollector() != null ? loan.getCollector().getId() : null);
        result.put("created_at", loan.getCreatedAt());
        result.put("updated_at", loan.getUpdatedAt());
        if (loan.getMember() != null) {
            result.put("member", Map.of(
                    "id", loan.getMember().getId(),
                    "first_name", loan.getMember().getFirstName(),
                    "last_name", loan.getMember().getLastName()));
        }
        if (loan.getCollector() != null) {
            result.put("collector", Map.of(
                    "id", loan.getCollector().getId(),
                    "first_name", loan.getCollector().getFirstName(),
                    "last_name", loan.getCollector().getLastName()));
        }
        return result;
    }

    private Map<String, Object> toTransactionMap(Transaction transaction) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", transaction.getId());
        result.put("member_id", transaction.getMember() != null ? transaction.getMember().getId() : null);
        result.put("collected_by", transaction.getCollector() != null ? transaction.getCollector().getId() : null);
        result.put("payment_date", transaction.getPaymentDate());
        result.put("amount", transaction.getAmount());
        result.put("payment_type", transaction.getPaymentType() != null ? transaction.getPaymentType().name() : null);
        result.put("payment_method", transaction.getPaymentMethod() != null ? transaction.getPaymentMethod().name() : null);
        result.put("status", transaction.getStatus() != null ? transaction.getStatus().name() : null);
        result.put("receipt_number", transaction.getReceiptNumber());
        result.put("note", transaction.getNote());
        result.put("created_at", transaction.getCreatedAt());
        result.put("updated_at", transaction.getUpdatedAt());
        return result;
    }

    private byte[] buildLoanReceiptPdf(MemberLoan loan) {
        try {
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            Document document = new Document(PageSize.LETTER, 50, 50, 50, 50);
            PdfWriter.getInstance(document, outputStream);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.RED);
            Font headingFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10);
            Font mutedFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(90, 90, 90));

            Paragraph churchHeader = new Paragraph("DEBRE TSEHAY ABUNE AREGAWI\nORTHODOX TEWAHEDO CHURCH", headingFont);
            churchHeader.setAlignment(Element.ALIGN_CENTER);
            document.add(churchHeader);
            Paragraph churchMeta = new Paragraph(
                    "1621 S Jupiter Rd, Garland, TX 75042\nPhone: (469) 436-3356  |  Email: abunearegawitx@gmail.com",
                    mutedFont);
            churchMeta.setAlignment(Element.ALIGN_CENTER);
            churchMeta.setSpacingAfter(18);
            document.add(churchMeta);

            Paragraph title = new Paragraph("LOAN RECEIPT - NOT A DONATION", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(18);
            document.add(title);

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMMM d, yyyy");
            Paragraph issued = new Paragraph("Date Issued: " + LocalDate.now().format(formatter), bodyFont);
            issued.setSpacingAfter(4);
            document.add(issued);
            document.add(new Paragraph("Loan Receipt #: " + loan.getId(), bodyFont));
            document.add(Chunk.NEWLINE);

            Paragraph detailsHeader = new Paragraph("Loan Details", headingFont);
            detailsHeader.setSpacingAfter(10);
            document.add(detailsHeader);

            PdfPTable table = new PdfPTable(2);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2f, 3f});
            addDetailRow(table, "Member Name", loan.getMember().getFirstName() + " " + loan.getMember().getLastName(), bodyFont);
            addDetailRow(table, "Loan Date", loan.getLoanDate().format(formatter), bodyFont);
            addDetailRow(table, "Loan Amount", currency(loan.getAmount()), bodyFont);
            addDetailRow(table, "Outstanding Balance", currency(loan.getOutstandingBalance()), bodyFont);
            addDetailRow(table, "Payment Method", titleCase(loan.getPaymentMethod()), bodyFont);
            if (loan.getReceiptNumber() != null) {
                addDetailRow(table, "Receipt / Check Number", loan.getReceiptNumber(), bodyFont);
            }
            addDetailRow(table, "Loan Status", loan.getStatus().name(), bodyFont);
            if (loan.getNotes() != null) {
                addDetailRow(table, "Notes", loan.getNotes(), bodyFont);
            }
            table.setSpacingAfter(18);
            document.add(table);

            PdfPTable notice = new PdfPTable(1);
            notice.setWidthPercentage(100);
            PdfPCell noticeCell = new PdfPCell(new Phrase(
                    "IMPORTANT NOTICE\nThis payment constitutes a loan to Debre Tsehay Abune Aregawi Orthodox Tewahedo Church and will be repaid in full. It is NOT a charitable donation and is NOT tax-deductible. Please retain this receipt as proof of your loan.",
                    bodyFont));
            noticeCell.setBackgroundColor(new Color(255, 243, 205));
            noticeCell.setBorderColor(new Color(204, 136, 0));
            noticeCell.setPadding(12);
            notice.addCell(noticeCell);
            notice.setSpacingAfter(28);
            document.add(notice);

            PdfPTable signatures = new PdfPTable(2);
            signatures.setWidthPercentage(100);
            PdfPCell sig1 = new PdfPCell(new Phrase("______________________________\nChurch Treasurer Signature", bodyFont));
            PdfPCell sig2 = new PdfPCell(new Phrase("______________________________\nDate", bodyFont));
            sig1.setBorder(Rectangle.NO_BORDER);
            sig2.setBorder(Rectangle.NO_BORDER);
            signatures.addCell(sig1);
            signatures.addCell(sig2);
            document.add(signatures);

            document.close();
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate receipt");
        }
    }

    private void addDetailRow(PdfPTable table, String label, String value, Font font) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        PdfPCell valueCell = new PdfPCell(new Phrase(value, font));
        labelCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPaddingBottom(6);
        valueCell.setPaddingBottom(6);
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    private void validatePaymentMethod(String paymentMethod) {
        if (!VALID_PAYMENT_METHODS.contains(paymentMethod)) {
            throw new BadRequestException("Payment method must be one of: cash, check, zelle, other");
        }
    }

    private void validateReceiptRequirement(String paymentMethod, String receiptNumber) {
        if ((paymentMethod.equals("cash") || paymentMethod.equals("check")) && (receiptNumber == null || receiptNumber.isBlank())) {
            throw new BadRequestException("Receipt number is required for cash and check payments");
        }
    }

    private void validateReceiptUniqueness(String receiptNumber) {
        String normalized = emptyToNull(receiptNumber);
        if (normalized != null && !"000".equals(normalized) && transactionRepository.existsByReceiptNumber(normalized)) {
            throw new ConflictException("Receipt number \"" + normalized + "\" has already been used. Please use a unique receipt number.");
        }
    }

    private MemberLoan.Status parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return MemberLoan.Status.valueOf(status);
        } catch (Exception ex) {
            throw new BadRequestException("Invalid loan status");
        }
    }

    private BigDecimal decimalValue(Object value) {
        if (value == null) {
            return null;
        }
        return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
    }

    private Long longValue(Object value) {
        if (value == null) {
            return null;
        }
        return ((Number) value).longValue();
    }

    private String stringValue(Object value) {
        if (value == null) {
            return null;
        }
        String str = value.toString().trim();
        return str.isEmpty() ? null : str;
    }

    private LocalDate localDateValue(Object value) {
        if (value == null) {
            return null;
        }
        return LocalDate.parse(value.toString());
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private String currency(BigDecimal amount) {
        return "$" + amount.setScale(2, RoundingMode.HALF_UP);
    }

    private String titleCase(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1).replace('_', ' ');
    }
}
