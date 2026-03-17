package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.TransactionRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatementService {

    private static final List<String> TAX_DEDUCTIBLE_GL_CODES =
            List.of("INC001", "INC002", "INC003", "INC004", "INC008");
    private static final List<String> TAX_DEDUCTIBLE_PAYMENT_TYPES =
            List.of("membership_due", "offering", "tithe", "event", "donation", "vow");

    private final MemberRepository memberRepository;
    private final TransactionRepository transactionRepository;

    @Value("${CHURCH_EIN:—}")
    private String churchEin;

    /**
     * Resolves head-of-household and all family member IDs for any given member.
     */
    public HouseholdResult resolveHousehold(Member member) {
        Long effectiveFamilyId = member.getFamilyHead() != null
                ? member.getFamilyHead().getId()
                : member.getId();

        // Find all members sharing this family: those whose familyHead.id = effectiveFamilyId,
        // plus the head themselves (id = effectiveFamilyId)
        List<Member> familyMembers = new ArrayList<>();
        familyMembers.addAll(memberRepository.findByFamilyHeadId(effectiveFamilyId));
        memberRepository.findById(effectiveFamilyId).ifPresent(familyMembers::add);

        // Deduplicate by id
        List<Member> distinct = familyMembers.stream()
                .collect(Collectors.toMap(Member::getId, m -> m, (a, b) -> a))
                .values()
                .stream()
                .toList();

        // Head is the member whose familyHead is null and whose id equals effectiveFamilyId
        Member headOfHousehold = distinct.stream()
                .filter(m -> m.getFamilyHead() == null && m.getId().equals(effectiveFamilyId))
                .findFirst()
                .orElse(member);

        List<Long> familyMemberIds = distinct.stream()
                .map(Member::getId)
                .collect(Collectors.toList());

        return new HouseholdResult(headOfHousehold, familyMemberIds);
    }

    /**
     * Builds statement data for a member looked up by Firebase principal.
     */
    public StatementData buildStatementData(Member member, int year) {
        HouseholdResult household = resolveHousehold(member);
        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = LocalDate.of(year, 12, 31);
        List<Transaction> transactions = transactionRepository.findTaxDeductibleForHousehold(
                household.familyMemberIds(),
                startDate,
                endDate,
                TAX_DEDUCTIBLE_GL_CODES,
                TAX_DEDUCTIBLE_PAYMENT_TYPES);
        return new StatementData(household.headOfHousehold(), transactions, year);
    }

    /**
     * Builds statement data for a member looked up by primary key.
     */
    public StatementData buildStatementDataById(Long memberId, int year) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Member not found"));
        return buildStatementData(member, year);
    }

    /**
     * Generates a contribution statement PDF and returns the raw bytes.
     */
    public byte[] generatePdf(Member member, List<Transaction> transactions, int year) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        Document document = new Document(PageSize.LETTER, 50, 50, 50, 50);
        PdfWriter writer = PdfWriter.getInstance(document, baos);
        document.open();

        // ── Fonts ──────────────────────────────────────────────
        Font boldLarge = new Font(Font.HELVETICA, 13, Font.BOLD, Color.BLACK);
        Font boldMedium = new Font(Font.HELVETICA, 11, Font.BOLD, Color.BLACK);
        Font boldNormal = new Font(Font.HELVETICA, 10, Font.BOLD, Color.BLACK);
        Font boldSmall = new Font(Font.HELVETICA, 9, Font.BOLD, Color.BLACK);
        Font normal = new Font(Font.HELVETICA, 10, Font.NORMAL, Color.BLACK);
        Font small = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.BLACK);
        Font smallGray = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(0x33, 0x33, 0x33));
        Font subGray = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(0x55, 0x55, 0x55));

        // ── Church Letterhead ──────────────────────────────────
        Paragraph churchName = new Paragraph("DEBRE TSEHAY ABUNE AREGAWI", boldLarge);
        churchName.setSpacingAfter(2);
        document.add(churchName);

        Paragraph churchSubtitle = new Paragraph("ORTHODOX TEWAHEDO CHURCH", boldNormal);
        churchSubtitle.setSpacingAfter(2);
        document.add(churchSubtitle);

        Paragraph address = new Paragraph("1621 S Jupiter Rd, Garland, TX 75042", subGray);
        address.setSpacingAfter(2);
        document.add(address);

        Paragraph contact = new Paragraph(
                "Phone: (469) 436-3356  |  Email: abunearegawitx@gmail.com", subGray);
        contact.setSpacingAfter(8);
        document.add(contact);

        // Horizontal separator line
        PdfContentByte canvas = writer.getDirectContent();
        float pageWidth = document.getPageSize().getWidth();
        float leftMargin = document.leftMargin();
        float rightMargin = document.rightMargin();
        float lineY = writer.getVerticalPosition(true) - 2;
        canvas.setLineWidth(1.5f);
        canvas.setColorStroke(new Color(0x33, 0x33, 0x33));
        canvas.moveTo(leftMargin, lineY);
        canvas.lineTo(pageWidth - rightMargin, lineY);
        canvas.stroke();

        Paragraph spacer1 = new Paragraph(" ");
        spacer1.setSpacingAfter(4);
        document.add(spacer1);

        // ── Tax ID ─────────────────────────────────────────────
        Paragraph ein = new Paragraph("Tax ID (EIN): " + churchEin, smallGray);
        ein.setSpacingAfter(10);
        document.add(ein);

        // ── Date & Member Info ─────────────────────────────────
        String today = LocalDate.now()
                .format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US));
        document.add(new Paragraph("Date: " + today, normal));

        String memberName = member.getFirstName() + " " + member.getLastName();
        Paragraph nameP = new Paragraph("Member Name: " + memberName, normal);
        nameP.setSpacingBefore(4);
        document.add(nameP);

        String cityLine = List.of(member.getCity(), member.getState(), member.getPostalCode())
                .stream()
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(", "));
        String addrLine1 = member.getStreetLine1() != null ? member.getStreetLine1() : "";
        String memberAddress = List.of(addrLine1, cityLine)
                .stream()
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(", "));

        if (!memberAddress.isBlank()) {
            Paragraph addrP = new Paragraph("Member Address: " + memberAddress, normal);
            addrP.setSpacingBefore(4);
            document.add(addrP);
        }

        // ── Subject ────────────────────────────────────────────
        Paragraph subject = new Paragraph(
                "Subject: Annual Contribution Statement for Tax Year " + year, boldNormal);
        subject.setSpacingBefore(14);
        subject.setSpacingAfter(14);
        document.add(subject);

        // ── Salutation ─────────────────────────────────────────
        String salutation = (member.getSpouseName() != null && !member.getSpouseName().isBlank())
                ? "Dear " + memberName + " and " + member.getSpouseName() + ","
                : "Dear " + memberName + ",";
        Paragraph salutationP = new Paragraph(salutation, normal);
        salutationP.setSpacingAfter(10);
        document.add(salutationP);

        // ── Body ───────────────────────────────────────────────
        Paragraph peace = new Paragraph("Peace and blessings to you.", normal);
        peace.setSpacingAfter(8);
        document.add(peace);

        Paragraph thankYou = new Paragraph(
                "Thank you for your faithful support of Debre Tsehay Abune Aregawi Orthodox Tewahedo Church. "
                + "Your generosity enables our parish to continue its worship services, ministries, and outreach "
                + "within the community in the name of our Lord Jesus Christ.",
                normal);
        thankYou.setSpacingAfter(8);
        document.add(thankYou);

        Paragraph records = new Paragraph(
                "According to our records, the following is a summary of your charitable contributions for the tax year "
                + year + ".",
                normal);
        records.setSpacingAfter(14);
        document.add(records);

        // ── Contribution Summary heading ───────────────────────
        Paragraph summaryHeading = new Paragraph("Contribution Summary", boldMedium);
        summaryHeading.setSpacingAfter(8);
        document.add(summaryHeading);

        // ── Contribution Table ─────────────────────────────────
        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1.5f, 3.2f, 2.0f, 1.3f});

        // Table header row
        addTableHeaderCell(table, "Date", boldSmall);
        addTableHeaderCell(table, "Description", boldSmall);
        addTableHeaderCell(table, "Method", boldSmall);
        addTableHeaderCellRight(table, "Amount", boldSmall);

        // Data rows
        NumberFormat currencyFmt = NumberFormat.getCurrencyInstance(Locale.US);
        DateTimeFormatter rowDateFmt = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US);
        BigDecimal total = BigDecimal.ZERO;

        for (Transaction t : transactions) {
            String dateStr = t.getPaymentDate() != null
                    ? t.getPaymentDate().format(rowDateFmt)
                    : "";
            String categoryName = (t.getIncomeCategory() != null && t.getIncomeCategory().getName() != null)
                    ? t.getIncomeCategory().getName()
                    : formatPaymentType(t.getPaymentType() != null ? t.getPaymentType().name() : "");
            String methodStr = formatPaymentType(
                    t.getPaymentMethod() != null ? t.getPaymentMethod().name() : "");
            String amountStr = t.getAmount() != null ? currencyFmt.format(t.getAmount()) : "$0.00";

            addTableDataCell(table, dateStr, small);
            addTableDataCell(table, categoryName, small);
            addTableDataCell(table, methodStr, small);
            addTableDataCellRight(table, amountStr, small);

            if (t.getAmount() != null) {
                total = total.add(t.getAmount());
            }
        }

        // Total row — spans first 3 cols, amount right-aligned
        PdfPCell totalLabelCell = new PdfPCell(
                new Phrase("Total Contributions for " + year + ":", boldNormal));
        totalLabelCell.setColspan(3);
        totalLabelCell.setBorder(Rectangle.TOP);
        totalLabelCell.setPaddingTop(6);
        totalLabelCell.setPaddingBottom(4);
        table.addCell(totalLabelCell);

        PdfPCell totalAmountCell = new PdfPCell(
                new Phrase(currencyFmt.format(total), boldNormal));
        totalAmountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalAmountCell.setBorder(Rectangle.TOP);
        totalAmountCell.setPaddingTop(6);
        totalAmountCell.setPaddingBottom(4);
        table.addCell(totalAmountCell);

        document.add(table);

        // ── Disclaimers ────────────────────────────────────────
        Paragraph disclaimer1 = new Paragraph(
                "For federal income tax purposes, please note that no goods or services were provided in "
                + "exchange for these contributions other than intangible religious benefits.",
                smallGray);
        disclaimer1.setSpacingBefore(12);
        disclaimer1.setSpacingAfter(6);
        document.add(disclaimer1);

        Paragraph disclaimer2 = new Paragraph(
                "Please retain this statement for your tax records. If you believe any information on this "
                + "statement is inaccurate or if you have any questions, please contact the church office.",
                smallGray);
        disclaimer2.setSpacingAfter(14);
        document.add(disclaimer2);

        // ── Closing ────────────────────────────────────────────
        Paragraph closing1 = new Paragraph(
                "Thank you again for your generosity and commitment to the work of Christ through His Church.",
                normal);
        closing1.setSpacingAfter(8);
        document.add(closing1);

        Paragraph closing2 = new Paragraph("May God bless you and your family abundantly.", normal);
        closing2.setSpacingAfter(24);
        document.add(closing2);

        document.add(new Paragraph("Sincerely,", normal));

        Paragraph churchSignature = new Paragraph(
                "Debre Tsehay Abune Aregawi Orthodox Tewahedo Church", boldNormal);
        churchSignature.setSpacingBefore(24);
        document.add(churchSignature);

        document.close();
        return baos.toByteArray();
    }

    // ── Helper types ───────────────────────────────────────────

    public record HouseholdResult(Member headOfHousehold, List<Long> familyMemberIds) {}

    public record StatementData(Member headOfHousehold, List<Transaction> transactions, int year) {}

    // ── Private helpers ────────────────────────────────────────

    private String formatPaymentType(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return raw.replace("_", " ")
                .chars()
                .collect(StringBuilder::new,
                        (sb, c) -> {
                            if (sb.isEmpty() || sb.charAt(sb.length() - 1) == ' ') {
                                sb.append(Character.toUpperCase(c));
                            } else {
                                sb.append((char) c);
                            }
                        },
                        StringBuilder::append)
                .toString();
    }

    private void addTableHeaderCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBorder(Rectangle.BOTTOM);
        cell.setPaddingBottom(4);
        table.addCell(cell);
    }

    private void addTableHeaderCellRight(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        cell.setBorder(Rectangle.BOTTOM);
        cell.setPaddingBottom(4);
        table.addCell(cell);
    }

    private void addTableDataCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPaddingTop(3);
        cell.setPaddingBottom(3);
        table.addCell(cell);
    }

    private void addTableDataCellRight(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPaddingTop(3);
        cell.setPaddingBottom(3);
        table.addCell(cell);
    }
}
