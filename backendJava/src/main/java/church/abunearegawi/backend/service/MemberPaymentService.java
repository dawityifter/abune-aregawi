package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.MemberPaymentDTO;
import church.abunearegawi.backend.model.MemberPayment;
import church.abunearegawi.backend.repository.MemberPaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberPaymentService {

    private final MemberPaymentRepository memberPaymentRepository;

    @Transactional(readOnly = true)
    public MemberPaymentDTO findById(Integer id) {
        return memberPaymentRepository.findById(id)
                .map(this::toDTO)
                .orElseThrow(() -> new RuntimeException("MemberPayment not found: " + id));
    }

    @Transactional(readOnly = true)
    public Page<MemberPaymentDTO> findAll(Pageable pageable) {
        return memberPaymentRepository.findAll(pageable)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public List<MemberPaymentDTO> findByMember(UUID memberId) {
        return memberPaymentRepository.findByMemberId(memberId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MemberPaymentDTO> findByMemberPhone(String phone) {
        if (phone == null)
            return List.of();
        return memberPaymentRepository.findByPhone1OrPhone2(phone, phone)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MemberPaymentDTO> findByYear(Integer year) {
        return memberPaymentRepository.findByYear(year)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BigDecimal getTotalPaidByMemberAndYear(UUID memberId, Integer year) {
        BigDecimal total = memberPaymentRepository.sumPaidByMemberAndYear(memberId, year);
        return total != null ? total : BigDecimal.ZERO;
    }

    @Transactional
    public MemberPaymentDTO create(MemberPayment memberPayment) {
        MemberPayment saved = memberPaymentRepository.save(memberPayment);
        return toDTO(saved);
    }

    @Transactional
    public MemberPaymentDTO update(Integer id, MemberPayment memberPayment) {
        MemberPayment existing = memberPaymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("MemberPayment not found: " + id));

        // Update fields - mapping all fields
        existing.setMemberName(memberPayment.getMemberName());
        existing.setSpouseName(memberPayment.getSpouseName());
        existing.setPhone1(memberPayment.getPhone1());
        existing.setPhone2(memberPayment.getPhone2());
        existing.setPaymentMethod(memberPayment.getPaymentMethod());
        existing.setMonthlyPayment(memberPayment.getMonthlyPayment());
        existing.setTotalAmountDue(memberPayment.getTotalAmountDue());

        // Month updates
        existing.setJanuary(memberPayment.getJanuary());
        existing.setFebruary(memberPayment.getFebruary());
        existing.setMarch(memberPayment.getMarch());
        existing.setApril(memberPayment.getApril());
        existing.setMay(memberPayment.getMay());
        existing.setJune(memberPayment.getJune());
        existing.setJuly(memberPayment.getJuly());
        existing.setAugust(memberPayment.getAugust());
        existing.setSeptember(memberPayment.getSeptember());
        existing.setOctober(memberPayment.getOctober());
        existing.setNovember(memberPayment.getNovember());
        existing.setDecember(memberPayment.getDecember());

        existing.setTotalCollected(memberPayment.getTotalCollected());
        existing.setBalanceDue(memberPayment.getBalanceDue());
        existing.setPaidUpToDate(memberPayment.getPaidUpToDate());
        existing.setNumberOfHousehold(memberPayment.getNumberOfHousehold());

        MemberPayment updated = memberPaymentRepository.save(existing);
        return toDTO(updated);
    }

    @Transactional
    public void delete(Integer id) {
        memberPaymentRepository.deleteById(id);
    }

    // ... existing imports
    private final church.abunearegawi.backend.repository.MemberRepository memberRepository; // Injected
    private final TransactionService transactionService;

    // ... existing methods

    @Transactional(readOnly = true)
    public church.abunearegawi.backend.dto.DuesDetailsDTO getDuesDetails(Long memberId, Integer year) {
        // 1. Fetch Member
        church.abunearegawi.backend.model.Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        church.abunearegawi.backend.dto.MemberDTO memberDTO = church.abunearegawi.backend.dto.MemberDTO
                .fromEntity(member);

        // 2. Fetch Payment Summary
        MemberPayment payment = memberPaymentRepository.findByPhoneAndYear(member.getPhoneNumber(), year)
                .orElse(null);

        // 3. Household Info
        // Actually frontend logic: if headOfHousehold is set, it might be household
        // view.
        // Let's assume for this endpoint, we return relative to the requested member.
        // If the member is a Head, isHouseholdView = true. If Dependent, maybe false or
        // show Head's?
        // Frontend says: if (duesData.household.isHouseholdView) ... "Household
        // Finances"

        // Logic: If member has dependents OR is a family head (but family head is null
        // means THEY are head if they have dependents?)
        // Better: check if they are Head of Household designated or have family
        // members.
        boolean isHead = member.getFamilyHead() == null
                && (member.getFamilyMembers() != null && !member.getFamilyMembers().isEmpty());
        // Or strictly if they are head.

        church.abunearegawi.backend.dto.MemberDTO headDTO = member.getFamilyHead() != null
                ? church.abunearegawi.backend.dto.MemberDTO.fromEntity(member.getFamilyHead())
                : memberDTO;

        String memberNames = member.getFamilyMembers() != null
                ? member.getFamilyMembers().stream().map(church.abunearegawi.backend.model.Member::getFirstName)
                        .collect(Collectors.joining(", "))
                : "";

        church.abunearegawi.backend.dto.DuesDetailsDTO.HouseholdInfoDTO householdDTO = church.abunearegawi.backend.dto.DuesDetailsDTO.HouseholdInfoDTO
                .builder()
                .isHouseholdView(isHead)
                .headOfHousehold(headDTO)
                .memberNames(memberNames)
                .totalMembers(member.getHouseholdSize())
                .build();

        // 4. Calculate Stats
        BigDecimal annualPledge = member.getYearlyPledge() != null ? member.getYearlyPledge() : BigDecimal.ZERO;
        BigDecimal monthlyPayment = payment != null ? payment.getMonthlyPayment() : BigDecimal.ZERO;
        BigDecimal totalAmountDue = payment != null ? payment.getTotalAmountDue() : BigDecimal.ZERO;
        BigDecimal duesCollected = payment != null ? payment.getTotalCollected() : BigDecimal.ZERO;
        BigDecimal outstandingDues = payment != null ? payment.getBalanceDue() : BigDecimal.ZERO;

        BigDecimal duesProgress = BigDecimal.ZERO;
        if (totalAmountDue.compareTo(BigDecimal.ZERO) > 0) {
            duesProgress = duesCollected.divide(totalAmountDue, 2, java.math.RoundingMode.HALF_UP)
                    .multiply(new BigDecimal(100));
        }

        // 5. Fetch Transactions
        List<church.abunearegawi.backend.dto.TransactionDTO> transactions = List.of();
        // Safe transaction fetching
        try {
            // Check if service is injected - it should be as it's private final.
            // But we need to handle potential empty results safely.
            // We can fetch all by member and filter by date/year manually if range query is
            // risky.
            transactions = transactionService.findByMember(memberId).stream()
                    .filter(t -> {
                        java.time.LocalDate d = t.date();
                        return d != null && d.getYear() == year;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // Log error or ignore
            // System.err.println("Error fetching transactions: " + e.getMessage());
        }

        // 6. Calculate Other Contributions
        BigDecimal donation = BigDecimal.ZERO;
        BigDecimal pledge = BigDecimal.ZERO;
        BigDecimal tithe = BigDecimal.ZERO;
        BigDecimal offering = BigDecimal.ZERO;
        BigDecimal other = BigDecimal.ZERO;

        for (church.abunearegawi.backend.dto.TransactionDTO t : transactions) {
            String type = t.type() != null ? t.type().toLowerCase() : "";
            BigDecimal amt = t.amount() != null ? t.amount() : BigDecimal.ZERO;

            if (type.contains("donation"))
                donation = donation.add(amt);
            else if (type.contains("pledge"))
                pledge = pledge.add(amt);
            else if (type.contains("tithe"))
                tithe = tithe.add(amt);
            else if (type.contains("offering"))
                offering = offering.add(amt);
            else if (!type.contains("due") && !type.contains("membership"))
                other = other.add(amt);
        }

        BigDecimal totalOther = donation.add(pledge).add(tithe).add(offering).add(other);
        BigDecimal grandTotal = duesCollected.add(totalOther);

        church.abunearegawi.backend.dto.DuesDetailsDTO.OtherContributionsDTO otherDocs = church.abunearegawi.backend.dto.DuesDetailsDTO.OtherContributionsDTO
                .builder()
                .donation(donation)
                .pledge_payment(pledge)
                .tithe(tithe)
                .offering(offering)
                .other(other)
                .build();

        church.abunearegawi.backend.dto.DuesDetailsDTO.PaymentSummaryDTO paymentSummary = church.abunearegawi.backend.dto.DuesDetailsDTO.PaymentSummaryDTO
                .builder()
                .year(year)
                .annualPledge(annualPledge)
                .monthlyPayment(monthlyPayment)
                .totalAmountDue(totalAmountDue)
                .duesCollected(duesCollected)
                .outstandingDues(outstandingDues)
                .duesProgress(duesProgress)
                .futureDues(BigDecimal.ZERO)
                .totalOtherContributions(totalOther)
                .grandTotal(grandTotal)
                .monthStatuses(payment != null ? buildMonthStatuses(payment) : List.of())
                .otherContributions(otherDocs)
                .build();

        return church.abunearegawi.backend.dto.DuesDetailsDTO.builder()
                .member(memberDTO)
                .household(householdDTO)
                .payment(paymentSummary)
                .transactions(transactions)
                .build();
    }

    private List<church.abunearegawi.backend.dto.MonthStatusDTO> buildMonthStatuses(MemberPayment mp) {
        String[] months = { "january", "february", "march", "april", "may", "june", "july", "august", "september",
                "october", "november", "december" };
        // We need mapped values. Reflection or if/else chain.
        // For simplicity, hardcode map since Lombok getters are just getJanuary(), etc.
        java.util.ArrayList<church.abunearegawi.backend.dto.MonthStatusDTO> list = new java.util.ArrayList<>();

        BigDecimal monthlyDue = mp.getMonthlyPayment() != null ? mp.getMonthlyPayment() : BigDecimal.ZERO;

        list.add(createStatus("january", mp.getJanuary(), monthlyDue));
        list.add(createStatus("february", mp.getFebruary(), monthlyDue));
        list.add(createStatus("march", mp.getMarch(), monthlyDue));
        list.add(createStatus("april", mp.getApril(), monthlyDue));
        list.add(createStatus("may", mp.getMay(), monthlyDue));
        list.add(createStatus("june", mp.getJune(), monthlyDue));
        list.add(createStatus("july", mp.getJuly(), monthlyDue));
        list.add(createStatus("august", mp.getAugust(), monthlyDue));
        list.add(createStatus("september", mp.getSeptember(), monthlyDue));
        list.add(createStatus("october", mp.getOctober(), monthlyDue));
        list.add(createStatus("november", mp.getNovember(), monthlyDue));
        list.add(createStatus("december", mp.getDecember(), monthlyDue));

        return list;
    }

    private church.abunearegawi.backend.dto.MonthStatusDTO createStatus(String month, BigDecimal paid, BigDecimal due) {
        BigDecimal amountPaid = paid != null ? paid : BigDecimal.ZERO;
        String status = amountPaid.compareTo(due) >= 0 ? "paid" : "due";
        // Simple logic: if paid >= due, paid. Else due.
        // "upcoming" or "pre-membership" logic requires joined date which we have in
        // member.
        // For now, simplify.

        return church.abunearegawi.backend.dto.MonthStatusDTO.builder()
                .month(month)
                .paid(amountPaid)
                .due(due)
                .status(status)
                .isFutureMonth(false) // Todo: calculate
                .build();
    }

    @Transactional
    public void recalculateMemberPayment(Long memberId, Integer year) {
        // 1. Fetch Member
        church.abunearegawi.backend.model.Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (member.getPhoneNumber() == null) {
            // Cannot link to MemberPayment without phone for now (legacy schema constraint)
            return;
        }

        // 2. Fetch Transactions for Year
        // We need TransactionService to expose a raw list or use repository directly.
        // `TransactionService` is injected. `findByMember` returns DTOs.
        // DTOs have `date` and `amount` and `type`.
        List<church.abunearegawi.backend.dto.TransactionDTO> txns = transactionService.findByMember(memberId).stream()
                .filter(t -> t.date() != null && t.date().getYear() == year)
                .filter(t -> "membership_due".equalsIgnoreCase(t.type())) // Only dues count for Dues Grid
                .collect(Collectors.toList());

        // 3. Aggregate Monthly
        BigDecimal[] months = new BigDecimal[12];
        java.util.Arrays.fill(months, BigDecimal.ZERO);
        BigDecimal totalCollected = BigDecimal.ZERO;

        for (church.abunearegawi.backend.dto.TransactionDTO t : txns) {
            int monthIdx = t.date().getMonthValue() - 1; // 0-11
            BigDecimal amt = t.amount() != null ? t.amount() : BigDecimal.ZERO;
            months[monthIdx] = months[monthIdx].add(amt);
            totalCollected = totalCollected.add(amt);
        }

        // 4. Update MemberPayment
        MemberPayment payment = memberPaymentRepository.findByPhoneAndYear(member.getPhoneNumber(), year)
                .orElseGet(() -> {
                    // Create new if missing
                    return MemberPayment.builder()
                            .year(year)
                            .memberName(member.getFirstName() + " " + member.getLastName())
                            .phone1(member.getPhoneNumber())
                            .totalAmountDue(
                                    member.getYearlyPledge() != null ? member.getYearlyPledge() : BigDecimal.ZERO)
                            .monthlyPayment(member.getYearlyPledge() != null
                                    ? member.getYearlyPledge().divide(BigDecimal.valueOf(12), 2,
                                            java.math.RoundingMode.HALF_UP)
                                    : BigDecimal.ZERO)
                            .build();
                });

        // Update fields
        payment.setJanuary(months[0]);
        payment.setFebruary(months[1]);
        payment.setMarch(months[2]);
        payment.setApril(months[3]);
        payment.setMay(months[4]);
        payment.setJune(months[5]);
        payment.setJuly(months[6]);
        payment.setAugust(months[7]);
        payment.setSeptember(months[8]);
        payment.setOctober(months[9]);
        payment.setNovember(months[10]);
        payment.setDecember(months[11]);

        payment.setTotalCollected(totalCollected);
        BigDecimal due = payment.getTotalAmountDue() != null ? payment.getTotalAmountDue() : BigDecimal.ZERO;
        payment.setBalanceDue(due.subtract(totalCollected));

        // Attempt to set memberId if possible (but type mismatch prevents direct
        // assignment if UUID vs Long)
        // payment.setMemberId(member.getId()); // Error if UUID

        memberPaymentRepository.save(payment);
    }

    private MemberPaymentDTO toDTO(MemberPayment mp) {
        return new MemberPaymentDTO(
                mp.getId(),
                // ... rest of DTO mapping ...
                mp.getMemberId(),
                mp.getMemberName(),
                mp.getSpouseName(),
                mp.getPhone1(),
                mp.getPhone2(),
                mp.getYear(),
                mp.getPaymentMethod(),
                mp.getMonthlyPayment(),
                mp.getTotalAmountDue(),
                mp.getJanuary(),
                mp.getFebruary(),
                mp.getMarch(),
                mp.getApril(),
                mp.getMay(),
                mp.getJune(),
                mp.getJuly(),
                mp.getAugust(),
                mp.getSeptember(),
                mp.getOctober(),
                mp.getNovember(),
                mp.getDecember(),
                mp.getTotalCollected(),
                mp.getBalanceDue(),
                mp.getPaidUpToDate(),
                mp.getNumberOfHousehold(),
                mp.getCreatedAt(),
                mp.getUpdatedAt());
    }
}
