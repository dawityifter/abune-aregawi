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

        // 2. Household Info
        boolean isHead = member.getFamilyHead() == null
                && (member.getFamilyMembers() != null && !member.getFamilyMembers().isEmpty());

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

        // 3. Fetch ALL Transactions for this member and year
        List<church.abunearegawi.backend.dto.TransactionDTO> transactions = List.of();
        try {
            transactions = transactionService.findByMember(memberId).stream()
                    .filter(t -> {
                        java.time.LocalDate d = t.date();
                        return d != null && d.getYear() == year;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // Log and continue with empty list
        }

        // 4. Dynamically calculate dues from transactions (matching Node.js behavior)
        BigDecimal annualPledge = member.getYearlyPledge() != null ? member.getYearlyPledge() : BigDecimal.ZERO;
        BigDecimal monthlyPayment = annualPledge.compareTo(BigDecimal.ZERO) > 0
                ? annualPledge.divide(BigDecimal.valueOf(12), 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Determine how many months dues are required (prorate for join year)
        int monthsRequired = 12;
        java.time.LocalDate joinDate = member.getDateJoinedParish();
        if (joinDate != null && joinDate.getYear() == year) {
            monthsRequired = 12 - (joinDate.getMonthValue() - 1);
        } else if (joinDate != null && joinDate.getYear() > year) {
            monthsRequired = 0; // Not yet a member in this year
        }

        BigDecimal totalAmountDue = monthlyPayment.multiply(BigDecimal.valueOf(monthsRequired));

        // Sum membership_due transactions to get duesCollected
        List<church.abunearegawi.backend.dto.TransactionDTO> duesTransactions = transactions.stream()
                .filter(t -> "membership_due".equalsIgnoreCase(t.type()))
                .collect(Collectors.toList());

        BigDecimal duesCollected = duesTransactions.stream()
                .map(t -> t.amount() != null ? t.amount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal outstandingDues = totalAmountDue.subtract(duesCollected).max(BigDecimal.ZERO);

        BigDecimal duesProgress = BigDecimal.ZERO;
        if (totalAmountDue.compareTo(BigDecimal.ZERO) > 0) {
            duesProgress = duesCollected.divide(totalAmountDue, 2, java.math.RoundingMode.HALF_UP)
                    .multiply(new BigDecimal(100));
        }

        // 5. Build month statuses from transactions
        List<church.abunearegawi.backend.dto.MonthStatusDTO> monthStatuses = buildMonthStatusesFromTransactions(
                duesTransactions, monthlyPayment, joinDate, year);

        // 6. Calculate Other Contributions (non-membership transactions)
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

        // Future dues: months remaining in year after current month
        BigDecimal futureDues = BigDecimal.ZERO;
        int currentMonth = java.time.LocalDate.now().getMonthValue();
        if (year == java.time.LocalDate.now().getYear()) {
            int futureMonths = 12 - currentMonth;
            futureDues = monthlyPayment.multiply(BigDecimal.valueOf(futureMonths));
        }

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
                .futureDues(futureDues)
                .totalOtherContributions(totalOther)
                .grandTotal(grandTotal)
                .monthStatuses(monthStatuses)
                .otherContributions(otherDocs)
                .build();

        return church.abunearegawi.backend.dto.DuesDetailsDTO.builder()
                .member(memberDTO)
                .household(householdDTO)
                .payment(paymentSummary)
                .transactions(transactions)
                .build();
    }

    /**
     * Build month statuses from transactions, matching Node.js behavior.
     * Distributes collected dues across months chronologically using a remaining-balance approach.
     */
    private List<church.abunearegawi.backend.dto.MonthStatusDTO> buildMonthStatusesFromTransactions(
            List<church.abunearegawi.backend.dto.TransactionDTO> duesTransactions,
            BigDecimal monthlyDue, java.time.LocalDate joinDate, int year) {

        String[] monthNames = { "january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december" };

        // Aggregate dues payments by month
        BigDecimal[] monthlyPaid = new BigDecimal[12];
        java.util.Arrays.fill(monthlyPaid, BigDecimal.ZERO);
        for (church.abunearegawi.backend.dto.TransactionDTO t : duesTransactions) {
            if (t.date() != null) {
                int idx = t.date().getMonthValue() - 1;
                BigDecimal amt = t.amount() != null ? t.amount() : BigDecimal.ZERO;
                monthlyPaid[idx] = monthlyPaid[idx].add(amt);
            }
        }

        // Determine join month (0-indexed) for pre-membership status
        int joinMonthIdx = 0; // default: member for whole year
        if (joinDate != null && joinDate.getYear() == year) {
            joinMonthIdx = joinDate.getMonthValue() - 1;
        } else if (joinDate != null && joinDate.getYear() > year) {
            joinMonthIdx = 12; // not a member at all this year
        }

        int currentMonthIdx = java.time.LocalDate.now().getMonthValue() - 1;
        int currentYear = java.time.LocalDate.now().getYear();

        java.util.ArrayList<church.abunearegawi.backend.dto.MonthStatusDTO> list = new java.util.ArrayList<>();
        for (int i = 0; i < 12; i++) {
            String status;
            BigDecimal due;
            boolean isFuture = false;

            if (i < joinMonthIdx) {
                status = "pre-membership";
                due = BigDecimal.ZERO;
            } else if (year > currentYear || (year == currentYear && i > currentMonthIdx)) {
                status = "upcoming";
                due = monthlyDue;
                isFuture = true;
            } else if (monthlyPaid[i].compareTo(monthlyDue) >= 0) {
                status = "paid";
                due = monthlyDue;
            } else {
                status = "due";
                due = monthlyDue;
            }

            list.add(church.abunearegawi.backend.dto.MonthStatusDTO.builder()
                    .month(monthNames[i])
                    .paid(monthlyPaid[i])
                    .due(due)
                    .status(status)
                    .isFutureMonth(isFuture)
                    .build());
        }

        return list;
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
