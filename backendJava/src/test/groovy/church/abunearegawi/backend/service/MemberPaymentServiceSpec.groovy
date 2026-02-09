package church.abunearegawi.backend.service

import church.abunearegawi.backend.dto.DuesDetailsDTO
import church.abunearegawi.backend.dto.MemberPaymentDTO
import church.abunearegawi.backend.dto.TransactionDTO
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.model.MemberPayment
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.repository.MemberPaymentRepository
import church.abunearegawi.backend.repository.MemberRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import spock.lang.Specification

import java.time.LocalDate

class MemberPaymentServiceSpec extends Specification {

    MemberPaymentRepository memberPaymentRepository = Mock()
    MemberRepository memberRepository = Mock()
    TransactionService transactionService = Mock()

    MemberPaymentService service = new MemberPaymentService(
            memberPaymentRepository, memberRepository, transactionService)

    MemberPayment testPayment = MemberPayment.builder()
            .id(1)
            .memberName("John Doe")
            .phone1("+11234567890")
            .year(2026)
            .monthlyPayment(new BigDecimal("100.00"))
            .totalAmountDue(new BigDecimal("1200.00"))
            .january(new BigDecimal("100.00"))
            .february(new BigDecimal("100.00"))
            .march(BigDecimal.ZERO)
            .april(BigDecimal.ZERO)
            .may(BigDecimal.ZERO)
            .june(BigDecimal.ZERO)
            .july(BigDecimal.ZERO)
            .august(BigDecimal.ZERO)
            .september(BigDecimal.ZERO)
            .october(BigDecimal.ZERO)
            .november(BigDecimal.ZERO)
            .december(BigDecimal.ZERO)
            .totalCollected(new BigDecimal("200.00"))
            .balanceDue(new BigDecimal("1000.00"))
            .build()

    // --- findById ---

    def "should find payment by id"() {
        given:
        memberPaymentRepository.findById(1) >> Optional.of(testPayment)

        when:
        def result = service.findById(1)

        then:
        result.id() == 1
        result.memberName() == "John Doe"
    }

    def "should throw when payment not found by id"() {
        given:
        memberPaymentRepository.findById(999) >> Optional.empty()

        when:
        service.findById(999)

        then:
        thrown(RuntimeException)
    }

    // --- findAll ---

    def "should find all payments paginated"() {
        given:
        def pageable = PageRequest.of(0, 10)
        memberPaymentRepository.findAll(pageable) >> new PageImpl<>([testPayment])

        when:
        def result = service.findAll(pageable)

        then:
        result.totalElements == 1
    }

    // --- findByMember ---

    def "should find by member id"() {
        given:
        UUID memberId = UUID.randomUUID()
        memberPaymentRepository.findByMemberId(memberId) >> [testPayment]

        when:
        def result = service.findByMember(memberId)

        then:
        result.size() == 1
    }

    // --- findByMemberPhone ---

    def "should find by member phone"() {
        given:
        memberPaymentRepository.findByPhone1OrPhone2("+11234567890", "+11234567890") >> [testPayment]

        when:
        def result = service.findByMemberPhone("+11234567890")

        then:
        result.size() == 1
    }

    def "should return empty for null phone"() {
        when:
        def result = service.findByMemberPhone(null)

        then:
        result.isEmpty()
    }

    // --- findByYear ---

    def "should find by year"() {
        given:
        memberPaymentRepository.findByYear(2026) >> [testPayment]

        when:
        def result = service.findByYear(2026)

        then:
        result.size() == 1
        result[0].year() == 2026
    }

    // --- getTotalPaidByMemberAndYear ---

    def "should get total paid by member and year"() {
        given:
        UUID memberId = UUID.randomUUID()
        memberPaymentRepository.sumPaidByMemberAndYear(memberId, 2026) >> new BigDecimal("600.00")

        when:
        def result = service.getTotalPaidByMemberAndYear(memberId, 2026)

        then:
        result == new BigDecimal("600.00")
    }

    def "should return zero when total is null"() {
        given:
        UUID memberId = UUID.randomUUID()
        memberPaymentRepository.sumPaidByMemberAndYear(memberId, 2026) >> null

        when:
        def result = service.getTotalPaidByMemberAndYear(memberId, 2026)

        then:
        result == BigDecimal.ZERO
    }

    // --- create ---

    def "should create payment"() {
        given:
        memberPaymentRepository.save(testPayment) >> testPayment

        when:
        def result = service.create(testPayment)

        then:
        result.memberName() == "John Doe"
    }

    // --- update ---

    def "should update payment"() {
        given:
        def updated = MemberPayment.builder()
                .memberName("Updated Name")
                .phone1("+11234567890")
                .monthlyPayment(new BigDecimal("150.00"))
                .totalAmountDue(new BigDecimal("1800.00"))
                .january(new BigDecimal("150.00"))
                .february(BigDecimal.ZERO)
                .march(BigDecimal.ZERO)
                .april(BigDecimal.ZERO)
                .may(BigDecimal.ZERO)
                .june(BigDecimal.ZERO)
                .july(BigDecimal.ZERO)
                .august(BigDecimal.ZERO)
                .september(BigDecimal.ZERO)
                .october(BigDecimal.ZERO)
                .november(BigDecimal.ZERO)
                .december(BigDecimal.ZERO)
                .totalCollected(new BigDecimal("150.00"))
                .balanceDue(new BigDecimal("1650.00"))
                .build()

        memberPaymentRepository.findById(1) >> Optional.of(testPayment)
        memberPaymentRepository.save(_ as MemberPayment) >> { MemberPayment mp -> mp }

        when:
        def result = service.update(1, updated)

        then:
        result.memberName() == "Updated Name"
        result.monthlyPayment() == new BigDecimal("150.00")
    }

    def "should throw when updating non-existent payment"() {
        given:
        memberPaymentRepository.findById(999) >> Optional.empty()

        when:
        service.update(999, MemberPayment.builder().build())

        then:
        thrown(RuntimeException)
    }

    // --- delete ---

    def "should delete payment"() {
        when:
        service.delete(1)

        then:
        1 * memberPaymentRepository.deleteById(1)
    }

    // --- getDuesDetails ---

    def "should get dues details"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .yearlyPledge(new BigDecimal("1200.00"))
                .householdSize(3)
                .role(Member.Role.member)
                .build()

        memberRepository.findById(1L) >> Optional.of(member)
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.of(testPayment)

        def txnDto = new TransactionDTO(
                1L, "membership_due", new BigDecimal("100.00"), LocalDate.of(2026, 1, 15),
                null, "cash", null, 1L, "John Doe", null, null, null, null, null, null, null, null, null)

        transactionService.findByMember(1L) >> [txnDto]

        when:
        def result = service.getDuesDetails(1L, 2026)

        then:
        result.member.firstName == "John"
        result.payment.year == 2026
        result.payment.annualPledge == new BigDecimal("1200.00")
        result.payment.duesCollected == new BigDecimal("200.00")
        result.payment.monthStatuses.size() == 12
    }

    def "should get dues details with no payment record"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .role(Member.Role.member)
                .build()

        memberRepository.findById(1L) >> Optional.of(member)
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.empty()
        transactionService.findByMember(1L) >> []

        when:
        def result = service.getDuesDetails(1L, 2026)

        then:
        result.payment.duesCollected == BigDecimal.ZERO
        result.payment.monthStatuses.isEmpty()
    }

    def "should throw when member not found for dues details"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.getDuesDetails(999L, 2026)

        then:
        thrown(RuntimeException)
    }

    def "should calculate other contributions in dues details"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .yearlyPledge(new BigDecimal("1200.00"))
                .householdSize(1)
                .role(Member.Role.member)
                .build()

        memberRepository.findById(1L) >> Optional.of(member)
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.of(testPayment)

        def donationTxn = new TransactionDTO(
                2L, "donation", new BigDecimal("50.00"), LocalDate.of(2026, 1, 20),
                null, "cash", null, 1L, "John Doe", null, null, null, null, null, null, null, null, null)
        def titheTxn = new TransactionDTO(
                3L, "tithe", new BigDecimal("75.00"), LocalDate.of(2026, 2, 1),
                null, "zelle", null, 1L, "John Doe", null, null, null, null, null, null, null, null, null)

        transactionService.findByMember(1L) >> [donationTxn, titheTxn]

        when:
        def result = service.getDuesDetails(1L, 2026)

        then:
        result.payment.otherContributions.donation == new BigDecimal("50.00")
        result.payment.otherContributions.tithe == new BigDecimal("75.00")
        result.payment.totalOtherContributions == new BigDecimal("125.00")
    }

    // --- recalculateMemberPayment ---

    def "should recalculate member payment"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .yearlyPledge(new BigDecimal("1200.00"))
                .build()

        memberRepository.findById(1L) >> Optional.of(member)

        def janTxn = new TransactionDTO(
                1L, "membership_due", new BigDecimal("100.00"), LocalDate.of(2026, 1, 15),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null)
        def febTxn = new TransactionDTO(
                2L, "membership_due", new BigDecimal("100.00"), LocalDate.of(2026, 2, 15),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null)
        def donationTxn = new TransactionDTO(
                3L, "donation", new BigDecimal("50.00"), LocalDate.of(2026, 1, 20),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null)

        transactionService.findByMember(1L) >> [janTxn, febTxn, donationTxn]
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.of(testPayment)
        memberPaymentRepository.save(_ as MemberPayment) >> { MemberPayment mp -> mp }

        when:
        service.recalculateMemberPayment(1L, 2026)

        then:
        1 * memberPaymentRepository.save({ MemberPayment mp ->
            mp.january == new BigDecimal("100.00") &&
            mp.february == new BigDecimal("100.00") &&
            mp.totalCollected == new BigDecimal("200.00")
        })
    }

    def "should create new payment record if not exists"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .yearlyPledge(new BigDecimal("1200.00"))
                .build()

        memberRepository.findById(1L) >> Optional.of(member)
        transactionService.findByMember(1L) >> []
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.empty()
        memberPaymentRepository.save(_ as MemberPayment) >> { MemberPayment mp -> mp }

        when:
        service.recalculateMemberPayment(1L, 2026)

        then:
        1 * memberPaymentRepository.save({ MemberPayment mp ->
            mp.year == 2026 && mp.memberName == "John Doe"
        })
    }

    def "should skip recalculation when member has no phone"() {
        given:
        def member = Member.builder().id(1L).firstName("NoPhone").build() // no phoneNumber
        memberRepository.findById(1L) >> Optional.of(member)

        when:
        service.recalculateMemberPayment(1L, 2026)

        then:
        0 * memberPaymentRepository.save(_)
    }

    def "should throw when member not found for recalculation"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.recalculateMemberPayment(999L, 2026)

        then:
        thrown(RuntimeException)
    }

    // --- month statuses ---

    def "should build month statuses correctly"() {
        given:
        def member = Member.builder()
                .id(1L).firstName("John").lastName("Doe")
                .phoneNumber("+11234567890")
                .role(Member.Role.member)
                .build()

        memberRepository.findById(1L) >> Optional.of(member)
        memberPaymentRepository.findByPhoneAndYear("+11234567890", 2026) >> Optional.of(testPayment)
        transactionService.findByMember(1L) >> []

        when:
        def result = service.getDuesDetails(1L, 2026)

        then:
        def statuses = result.payment.monthStatuses
        statuses.size() == 12
        statuses[0].month == "january"
        statuses[0].status == "paid" // 100 >= 100
        statuses[1].month == "february"
        statuses[1].status == "paid"
        statuses[2].month == "march"
        statuses[2].status == "due" // 0 < 100
    }
}
