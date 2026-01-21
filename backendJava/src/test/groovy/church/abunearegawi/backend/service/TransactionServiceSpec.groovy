package church.abunearegawi.backend.service

import church.abunearegawi.backend.dto.TransactionDTO
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.repository.TransactionRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import spock.lang.Specification

import java.time.LocalDate

class TransactionServiceSpec extends Specification {


    TransactionRepository transactionRepository = Mock()
    church.abunearegawi.backend.repository.MemberRepository memberRepository = Mock()
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

    def "should find transactions by member"() {
        given:
        Long memberId = 1L
        Transaction t1 = Transaction.builder().id(1L).member(church.abunearegawi.backend.model.Member.builder().id(memberId).build()).amount(new BigDecimal("50.00")).build()
        Transaction t2 = Transaction.builder().id(2L).member(church.abunearegawi.backend.model.Member.builder().id(memberId).build()).amount(new BigDecimal("75.00")).build()
        
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
}
