package church.abunearegawi.backend.service

import church.abunearegawi.backend.dto.TransactionDTO
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.repository.MemberRepository
import church.abunearegawi.backend.repository.TransactionRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import spock.lang.Specification

import java.time.LocalDate

class TransactionServiceSpec extends Specification {

    TransactionRepository transactionRepository = Mock()
    MemberRepository memberRepository = Mock()
    TransactionService transactionService = new TransactionService(transactionRepository, memberRepository)

    def "should find transaction by id"() {
        given:
        Long id = 1L
        Transaction transaction = Transaction.builder()
                .id(id)
                .amount(new BigDecimal("100.00"))
                .paymentType(Transaction.PaymentType.tithe)
                .build()

        transactionRepository.findById(id) >> Optional.of(transaction)

        when:
        TransactionDTO result = transactionService.findById(id)

        then:
        result.id() == id
        result.amount() == new BigDecimal("100.00")
        result.type() == "tithe"
    }

    def "should throw when transaction not found by id"() {
        given:
        transactionRepository.findById(999L) >> Optional.empty()

        when:
        transactionService.findById(999L)

        then:
        thrown(RuntimeException)
    }

    def "should find transactions by member"() {
        given:
        Long memberId = 1L
        Transaction t1 = Transaction.builder().id(1L).member(Member.builder().id(memberId).firstName("A").lastName("B").build()).amount(new BigDecimal("50.00")).build()
        Transaction t2 = Transaction.builder().id(2L).member(Member.builder().id(memberId).firstName("A").lastName("B").build()).amount(new BigDecimal("75.00")).build()

        transactionRepository.findByMemberId(memberId) >> [t1, t2]

        when:
        List<TransactionDTO> results = transactionService.findByMember(memberId)

        then:
        results.size() == 2
        results[0].amount() == new BigDecimal("50.00")
        results[1].amount() == new BigDecimal("75.00")
    }

    def "should calculate total by payment type"() {
        given:
        LocalDate start = LocalDate.now().minusDays(30)
        LocalDate end = LocalDate.now()
        BigDecimal expectedTotal = new BigDecimal("500.00")

        transactionRepository.sumByPaymentTypeAndDateRange(Transaction.PaymentType.tithe, start, end) >> expectedTotal

        when:
        BigDecimal total = transactionService.getTotalByPaymentTypeAndDateRange(Transaction.PaymentType.tithe, start, end)

        then:
        total == expectedTotal
    }

    def "should return zero when total by payment type is null"() {
        given:
        LocalDate start = LocalDate.now().minusDays(30)
        LocalDate end = LocalDate.now()

        transactionRepository.sumByPaymentTypeAndDateRange(Transaction.PaymentType.tithe, start, end) >> null

        when:
        BigDecimal total = transactionService.getTotalByPaymentTypeAndDateRange(Transaction.PaymentType.tithe, start, end)

        then:
        total == BigDecimal.ZERO
    }

    def "should calculate total by member and date range"() {
        given:
        Long memberId = 1L
        LocalDate start = LocalDate.now().minusDays(30)
        LocalDate end = LocalDate.now()

        transactionRepository.sumByMemberAndDateRange(memberId, start, end) >> new BigDecimal("300.00")

        when:
        BigDecimal total = transactionService.getTotalByMemberAndDateRange(memberId, start, end)

        then:
        total == new BigDecimal("300.00")
    }

    def "should return zero when total by member is null"() {
        given:
        transactionRepository.sumByMemberAndDateRange(1L, LocalDate.now(), LocalDate.now()) >> null

        when:
        BigDecimal total = transactionService.getTotalByMemberAndDateRange(1L, LocalDate.now(), LocalDate.now())

        then:
        total == BigDecimal.ZERO
    }

    def "should create transaction"() {
        given:
        Transaction input = Transaction.builder()
                .amount(new BigDecimal("200.00"))
                .paymentType(Transaction.PaymentType.donation)
                .build()

        Transaction saved = Transaction.builder()
                .id(1L)
                .amount(new BigDecimal("200.00"))
                .paymentType(Transaction.PaymentType.donation)
                .build()

        transactionRepository.save(input) >> saved

        when:
        TransactionDTO result = transactionService.create(input)

        then:
        result.id() == 1L
        result.amount() == new BigDecimal("200.00")
        result.type() == "donation"
    }

    def "should update transaction"() {
        given:
        Long id = 1L
        Transaction existing = Transaction.builder()
                .id(id)
                .amount(new BigDecimal("100.00"))
                .paymentType(Transaction.PaymentType.tithe)
                .build()

        Transaction updates = Transaction.builder()
                .amount(new BigDecimal("150.00"))
                .paymentDate(LocalDate.of(2026, 1, 15))
                .paymentMethod(Transaction.PaymentMethod.cash)
                .note("updated")
                .build()

        transactionRepository.findById(id) >> Optional.of(existing)
        transactionRepository.save(_ as Transaction) >> { Transaction t -> t }

        when:
        TransactionDTO result = transactionService.update(id, updates)

        then:
        result.amount() == new BigDecimal("150.00")
    }

    def "should throw when updating non-existent transaction"() {
        given:
        transactionRepository.findById(999L) >> Optional.empty()

        when:
        transactionService.update(999L, Transaction.builder().build())

        then:
        thrown(RuntimeException)
    }

    def "should delete transaction"() {
        when:
        transactionService.delete(1L)

        then:
        1 * transactionRepository.deleteById(1L)
    }

    def "should find all transactions paginated"() {
        given:
        def pageable = PageRequest.of(0, 10)
        Transaction t = Transaction.builder().id(1L).amount(new BigDecimal("50.00")).paymentType(Transaction.PaymentType.donation).build()
        Page<Transaction> page = new PageImpl<>([t], pageable, 1)

        transactionRepository.findAll(pageable) >> page

        when:
        Page<TransactionDTO> result = transactionService.findAll(pageable)

        then:
        result.totalElements == 1
        result.content[0].id() == 1L
    }

    def "should find by payment type"() {
        given:
        def pageable = PageRequest.of(0, 10)
        Transaction t = Transaction.builder().id(1L).amount(new BigDecimal("50.00")).paymentType(Transaction.PaymentType.tithe).build()
        Page<Transaction> page = new PageImpl<>([t], pageable, 1)

        transactionRepository.findByPaymentType(Transaction.PaymentType.tithe, pageable) >> page

        when:
        Page<TransactionDTO> result = transactionService.findByPaymentType(Transaction.PaymentType.tithe, pageable)

        then:
        result.content[0].type() == "tithe"
    }

    def "should find by date range"() {
        given:
        LocalDate start = LocalDate.of(2026, 1, 1)
        LocalDate end = LocalDate.of(2026, 1, 31)
        Transaction t = Transaction.builder().id(1L).amount(new BigDecimal("100.00")).paymentDate(LocalDate.of(2026, 1, 15)).build()

        transactionRepository.findByPaymentDateBetween(start, end) >> [t]

        when:
        List<TransactionDTO> result = transactionService.findByDateRange(start, end)

        then:
        result.size() == 1
        result[0].amount() == new BigDecimal("100.00")
    }

    def "should get fundraiser report"() {
        given:
        Member member = Member.builder().id(1L).firstName("John").lastName("Doe").build()
        Transaction t = Transaction.builder()
                .id(1L)
                .amount(new BigDecimal("100.00"))
                .paymentType(Transaction.PaymentType.tigray_hunger_fundraiser)
                .member(member)
                .build()

        transactionRepository.findByPaymentType(Transaction.PaymentType.tigray_hunger_fundraiser) >> [t]

        when:
        Map<String, Object> result = transactionService.getFundraiserReport("admin@test.com")

        then:
        result.containsKey("fundraiser")
        def fundraiser = result["fundraiser"] as Map
        fundraiser["totalCollected"] == new BigDecimal("100.00")
        fundraiser["email"] == "admin@test.com"
        (fundraiser["transactions"] as List).size() == 1
    }

    def "should get fundraiser report with null email"() {
        given:
        transactionRepository.findByPaymentType(Transaction.PaymentType.tigray_hunger_fundraiser) >> []

        when:
        Map<String, Object> result = transactionService.getFundraiserReport(null)

        then:
        def fundraiser = result["fundraiser"] as Map
        fundraiser["email"] == ""
        fundraiser["totalCollected"] == BigDecimal.ZERO
    }

    def "should get payment summary report"() {
        given:
        Member activeMember = Member.builder().id(1L).firstName("A").lastName("B").isActive(true).yearlyPledge(new BigDecimal("1200.00")).build()
        Member inactiveMember = Member.builder().id(2L).firstName("C").lastName("D").isActive(false).yearlyPledge(BigDecimal.ZERO).build()

        Transaction t = Transaction.builder().id(1L).amount(new BigDecimal("1200.00")).member(activeMember).paymentDate(LocalDate.of(LocalDate.now().getYear(), 6, 1)).build()

        memberRepository.findAll() >> [activeMember, inactiveMember]
        memberRepository.sumYearlyPledges() >> new BigDecimal("1200.00")
        transactionRepository.sumTotalByDateRange(_, _) >> new BigDecimal("1200.00")
        transactionRepository.findByPaymentDateBetween(_, _) >> [t]

        when:
        Map<String, Object> result = transactionService.getPaymentSummaryReport("admin@test.com")

        then:
        result.containsKey("summary")
        def summary = result["summary"] as Map
        summary["totalMembers"] == 1L
        summary["upToDateMembers"] == 1L
        summary["behindMembers"] == 0L
    }

    def "should get payment summary report with null totals"() {
        given:
        memberRepository.findAll() >> []
        memberRepository.sumYearlyPledges() >> null
        transactionRepository.sumTotalByDateRange(_, _) >> null
        transactionRepository.findByPaymentDateBetween(_, _) >> []

        when:
        Map<String, Object> result = transactionService.getPaymentSummaryReport(null)

        then:
        def summary = result["summary"] as Map
        summary["totalCollected"] == BigDecimal.ZERO
        summary["collectionRate"] == "0%"
    }

    def "should get skipped receipts"() {
        given:
        transactionRepository.findAllReceiptNumbers() >> [1, 2, 4, 5, 8]

        when:
        Map<String, Object> result = transactionService.getSkippedReceipts()

        then:
        def range = result["range"] as Map
        range["start"] == 1
        range["end"] == 8
        def skipped = result["skippedReceipts"] as List
        skipped.containsAll([3, 6, 7])
        skipped.size() == 3
    }

    def "should get skipped receipts when empty"() {
        given:
        transactionRepository.findAllReceiptNumbers() >> []

        when:
        Map<String, Object> result = transactionService.getSkippedReceipts()

        then:
        def range = result["range"] as Map
        range["start"] == 0
        range["end"] == 0
        (result["skippedReceipts"] as List).isEmpty()
    }

    def "should map DTO with full member and collector info"() {
        given:
        Member member = Member.builder().id(1L).firstName("John").lastName("Doe").build()
        Member collector = Member.builder().id(2L).firstName("Jane").lastName("Admin").build()
        def incomeCategory = church.abunearegawi.backend.model.IncomeCategory.builder().id(10L).name("Tithe").glCode("INC001").build()

        Transaction t = Transaction.builder()
                .id(1L)
                .amount(new BigDecimal("100.00"))
                .paymentType(Transaction.PaymentType.tithe)
                .paymentMethod(Transaction.PaymentMethod.cash)
                .paymentDate(LocalDate.of(2026, 1, 1))
                .receiptNumber("R001")
                .note("test note")
                .member(member)
                .collector(collector)
                .incomeCategory(incomeCategory)
                .build()

        when:
        TransactionDTO dto = transactionService.toDTO(t)

        then:
        dto.id() == 1L
        dto.type() == "tithe"
        dto.paymentMethod() == "cash"
        dto.checkNumber() == "R001"
        dto.memberId() == 1L
        dto.memberName() == "John Doe"
        dto.collectedById() == 2L
        dto.collectedByName() == "Jane Admin"
        dto.incomeCategoryId() == 10L
        dto.incomeCategoryName() == "Tithe"
        dto.notes() == "test note"
    }

    def "should map DTO with null member and collector"() {
        given:
        Transaction t = Transaction.builder()
                .id(1L)
                .amount(new BigDecimal("100.00"))
                .build()

        when:
        TransactionDTO dto = transactionService.toDTO(t)

        then:
        dto.memberId() == null
        dto.memberName() == null
        dto.collectedById() == null
        dto.collectedByName() == null
        dto.incomeCategoryId() == null
    }
}
