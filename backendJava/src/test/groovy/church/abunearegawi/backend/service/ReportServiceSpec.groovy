package church.abunearegawi.backend.service

import church.abunearegawi.backend.dto.PaymentStatsDTO
import church.abunearegawi.backend.model.LedgerEntry
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.repository.LedgerEntryRepository
import church.abunearegawi.backend.repository.MemberRepository
import church.abunearegawi.backend.repository.TransactionRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import spock.lang.Specification

import java.time.LocalDate

class ReportServiceSpec extends Specification {

    TransactionRepository transactionRepository = Mock()
    LedgerEntryRepository ledgerEntryRepository = Mock()
    MemberRepository memberRepository = Mock()
    ReportService reportService = new ReportService(transactionRepository, ledgerEntryRepository, memberRepository)

    def "should get weekly report with income transactions"() {
        given:
        LocalDate date = LocalDate.of(2026, 2, 4) // Wednesday
        Member member = Member.builder().id(1L).firstName("John").lastName("Doe").build()
        Transaction t = Transaction.builder()
                .id(1L)
                .amount(new BigDecimal("100.00"))
                .paymentType(Transaction.PaymentType.tithe)
                .paymentMethod(Transaction.PaymentMethod.cash)
                .paymentDate(date)
                .member(member)
                .build()

        transactionRepository.findByPaymentDateBetween(_, _) >> [t]
        ledgerEntryRepository.findExpenses(_, _, _, _, _, _) >> new PageImpl<>([], Pageable.unpaged(), 0)

        when:
        Map<String, Object> result = reportService.getWeeklyReport(date)

        then:
        result.containsKey("weekStart")
        result.containsKey("weekEnd")
        result.containsKey("byPaymentMethod")
        result.containsKey("summary")

        def summary = result["summary"] as Map
        summary["totalIncome"] == new BigDecimal("100.00")
        summary["totalExpenses"] == BigDecimal.ZERO
        summary["netTotal"] == new BigDecimal("100.00")
        summary["totalTransactions"] == 1
    }

    def "should get weekly report with expenses"() {
        given:
        LocalDate date = LocalDate.of(2026, 2, 4)
        LedgerEntry expense = LedgerEntry.builder()
                .id(1L)
                .amount(new BigDecimal("50.00"))
                .paymentMethod("cash")
                .category("EXP001")
                .memo("Office supplies")
                .entryDate(date)
                .build()

        transactionRepository.findByPaymentDateBetween(_, _) >> []
        ledgerEntryRepository.findExpenses(_, _, _, _, _, _) >> new PageImpl<>([expense], Pageable.unpaged(), 1)

        when:
        Map<String, Object> result = reportService.getWeeklyReport(date)

        then:
        def summary = result["summary"] as Map
        summary["totalIncome"] == BigDecimal.ZERO
        summary["totalExpenses"] == new BigDecimal("50.00")
        summary["netTotal"] == new BigDecimal("-50.00")
    }

    def "should get weekly report with mixed payment methods"() {
        given:
        LocalDate date = LocalDate.of(2026, 2, 4)
        Transaction t1 = Transaction.builder()
                .id(1L).amount(new BigDecimal("100.00"))
                .paymentMethod(Transaction.PaymentMethod.cash)
                .paymentType(Transaction.PaymentType.tithe)
                .build()
        Transaction t2 = Transaction.builder()
                .id(2L).amount(new BigDecimal("200.00"))
                .paymentMethod(Transaction.PaymentMethod.zelle)
                .paymentType(Transaction.PaymentType.donation)
                .build()

        transactionRepository.findByPaymentDateBetween(_, _) >> [t1, t2]
        ledgerEntryRepository.findExpenses(_, _, _, _, _, _) >> new PageImpl<>([], Pageable.unpaged(), 0)

        when:
        Map<String, Object> result = reportService.getWeeklyReport(date)

        then:
        def byMethod = result["byPaymentMethod"] as Map
        byMethod.containsKey("cash")
        byMethod.containsKey("zelle")
        def summary = result["summary"] as Map
        summary["totalIncome"] == new BigDecimal("300.00")
    }

    def "should get weekly report with null payment method"() {
        given:
        LocalDate date = LocalDate.of(2026, 2, 4)
        Transaction t = Transaction.builder()
                .id(1L).amount(new BigDecimal("50.00"))
                .paymentType(Transaction.PaymentType.donation)
                .build() // paymentMethod is null

        transactionRepository.findByPaymentDateBetween(_, _) >> [t]
        ledgerEntryRepository.findExpenses(_, _, _, _, _, _) >> new PageImpl<>([], Pageable.unpaged(), 0)

        when:
        Map<String, Object> result = reportService.getWeeklyReport(date)

        then:
        def byMethod = result["byPaymentMethod"] as Map
        byMethod.containsKey("other")
    }

    def "should get empty weekly report"() {
        given:
        transactionRepository.findByPaymentDateBetween(_, _) >> []
        ledgerEntryRepository.findExpenses(_, _, _, _, _, _) >> new PageImpl<>([], Pageable.unpaged(), 0)

        when:
        Map<String, Object> result = reportService.getWeeklyReport(LocalDate.of(2026, 2, 4))

        then:
        def summary = result["summary"] as Map
        summary["totalIncome"] == BigDecimal.ZERO
        summary["totalExpenses"] == BigDecimal.ZERO
        summary["totalTransactions"] == 0
    }

    def "should get stats"() {
        given:
        Member head1 = Member.builder().id(1L).firstName("A").lastName("B").build() // No familyHead = household head
        Member head2 = Member.builder().id(2L).firstName("C").lastName("D").build()
        Member dep = Member.builder().id(3L).firstName("E").lastName("F").familyHead(head1).build()

        memberRepository.count() >> 3L
        memberRepository.findAll() >> [head1, head2, dep]

        when:
        Map<String, Object> result = reportService.getStats()

        then:
        result["totalMembers"] == 3L
        result["totalHouseholds"] == 2L // head1 and head2 have null familyHead
    }

    def "should get payment stats"() {
        given:
        memberRepository.count() >> 10L
        transactionRepository.sumTotalByDateRange(_, _) >> new BigDecimal("5000.00")
        ledgerEntryRepository.sumByTypeAndDateRange("expense", _, _) >> new BigDecimal("2000.00")

        when:
        PaymentStatsDTO result = reportService.getPaymentStats()

        then:
        result.totalMembers() == 10L
        result.totalCollected() == new BigDecimal("5000.00")
        result.totalExpenses() == new BigDecimal("2000.00")
        result.netIncome() == new BigDecimal("3000.00")
    }

    def "should get payment stats with null values"() {
        given:
        memberRepository.count() >> 0L
        transactionRepository.sumTotalByDateRange(_, _) >> null
        ledgerEntryRepository.sumByTypeAndDateRange("expense", _, _) >> null

        when:
        PaymentStatsDTO result = reportService.getPaymentStats()

        then:
        result.totalMembers() == 0L
        result.totalCollected() == BigDecimal.ZERO
        result.totalExpenses() == BigDecimal.ZERO
        result.netIncome() == BigDecimal.ZERO
    }
}
