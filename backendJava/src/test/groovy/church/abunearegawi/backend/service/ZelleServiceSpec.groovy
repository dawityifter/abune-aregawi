package church.abunearegawi.backend.service

import church.abunearegawi.backend.model.IncomeCategory
import church.abunearegawi.backend.model.LedgerEntry
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.model.ZelleMemoMatch
import church.abunearegawi.backend.repository.IncomeCategoryRepository
import church.abunearegawi.backend.repository.LedgerEntryRepository
import church.abunearegawi.backend.repository.MemberRepository
import church.abunearegawi.backend.repository.TransactionRepository
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository
import spock.lang.Specification

import java.time.LocalDate

class ZelleServiceSpec extends Specification {

    ZelleMemoMatchRepository zelleMemoMatchRepository = Mock()
    MemberRepository memberRepository = Mock()
    TransactionRepository transactionRepository = Mock()
    IncomeCategoryRepository incomeCategoryRepository = Mock()
    LedgerEntryRepository ledgerEntryRepository = Mock()
    ZelleGmailService zelleGmailService = Mock()

    ZelleService zelleService = new ZelleService(
            zelleMemoMatchRepository, memberRepository, transactionRepository,
            incomeCategoryRepository, ledgerEntryRepository, zelleGmailService)

    Member testMember = Member.builder().id(1L).firstName("John").lastName("Doe").phoneNumber("+1234567890").build()
    Member testCollector = Member.builder().id(2L).firstName("Admin").lastName("User").build()

    def "should find all memo matches"() {
        given:
        def match = ZelleMemoMatch.builder().member(testMember).memo("test memo").build()
        zelleMemoMatchRepository.findAll() >> [match]

        when:
        def result = zelleService.findAll()

        then:
        result.size() == 1
        result[0].memo == "test memo"
    }

    def "should find by member id"() {
        given:
        def match = ZelleMemoMatch.builder().member(testMember).memo("memo1").build()
        zelleMemoMatchRepository.findByMemberId(1L) >> [match]

        when:
        def result = zelleService.findByMemberId(1L)

        then:
        result.size() == 1
    }

    def "should find by memo"() {
        given:
        def match = ZelleMemoMatch.builder().member(testMember).memo("church donation").build()
        zelleMemoMatchRepository.findByMemoContainingIgnoreCase("church") >> [match]

        when:
        def result = zelleService.findByMemo("church")

        then:
        result.size() == 1
    }

    def "should find by member id and memo"() {
        given:
        def match = ZelleMemoMatch.builder().member(testMember).memo("specific memo").build()
        zelleMemoMatchRepository.findByMemberIdAndMemo(1L, "specific memo") >> Optional.of(match)

        when:
        def result = zelleService.findByMemberIdAndMemo(1L, "specific memo")

        then:
        result.isPresent()
        result.get().memo == "specific memo"
    }

    def "should create memo match"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = zelleService.create(1L, "John", "Doe", "test memo")

        then:
        result.firstName == "John"
        result.lastName == "Doe"
        result.memo == "test memo"
    }

    def "should throw when creating memo match for non-existent member"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        zelleService.create(999L, "X", "Y", "memo")

        then:
        thrown(RuntimeException)
    }

    def "should delete memo match"() {
        given:
        UUID id = UUID.randomUUID()

        when:
        zelleService.delete(id)

        then:
        1 * zelleMemoMatchRepository.deleteById(id)
    }

    def "should preview gmail"() {
        given:
        zelleGmailService.previewZelleFromGmail(10) >> [preview: []]

        when:
        def result = zelleService.previewGmail(10)

        then:
        result.containsKey("preview")
    }

    // --- createTransaction tests ---

    def "should create transaction successfully"() {
        given:
        def incomeCategory = IncomeCategory.builder().id(1L).glCode("INC001").paymentTypeMapping("donation").build()

        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping("donation") >> [incomeCategory]
        transactionRepository.findByExternalId("ext123") >> Optional.empty()
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 10L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        zelleMemoMatchRepository.findByMemoIgnoreCase("test note") >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = zelleService.createTransaction(
                "ext123", new BigDecimal("100.00"), LocalDate.of(2026, 1, 15),
                "test note", 1L, "donation", 2L)

        then:
        result["id"] == 10L
        result.containsKey("data")
        def data = result["data"] as Map
        data["amount"] == new BigDecimal("100.00")
        data["payment_method"] == Transaction.PaymentMethod.zelle
    }

    def "should throw DuplicateTransactionException for duplicate external id"() {
        given:
        def existing = Transaction.builder().id(5L).externalId("dup123").build()
        transactionRepository.findByExternalId("dup123") >> Optional.of(existing)

        when:
        zelleService.createTransaction("dup123", new BigDecimal("50.00"), LocalDate.now(), null, null, null, 2L)

        then:
        def e = thrown(ZelleService.DuplicateTransactionException)
        e.existingId == 5L
    }

    def "should create transaction with null external id"() {
        given:
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping("donation") >> []
        incomeCategoryRepository.findByPaymentTypeMapping("donation") >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 11L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }

        when:
        def result = zelleService.createTransaction(
                null, new BigDecimal("50.00"), null, null, null, null, 2L)

        then:
        result["id"] == 11L
    }

    def "should create transaction with unknown payment type falling back to donation"() {
        given:
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping("unknown_type") >> []
        incomeCategoryRepository.findByPaymentTypeMapping("donation") >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 12L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }

        when:
        def result = zelleService.createTransaction(
                null, new BigDecimal("25.00"), LocalDate.now(), null, null, "unknown_type", 2L)

        then:
        result["id"] == 12L
    }

    def "should throw when collector not found"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        zelleService.createTransaction(null, new BigDecimal("10.00"), LocalDate.now(), null, null, null, 999L)

        then:
        thrown(RuntimeException)
    }

    def "should learn memo mapping on create transaction"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.findByExternalId(_) >> Optional.empty()
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 13L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        zelleMemoMatchRepository.findByMemoIgnoreCase("church donation") >> Optional.empty()

        when:
        zelleService.createTransaction(
                "ext456", new BigDecimal("100.00"), LocalDate.now(),
                "church donation", 1L, "donation", 2L)

        then:
        1 * zelleMemoMatchRepository.save({ ZelleMemoMatch m ->
            m.memo == "church donation" && m.member.id == 1L
        })
    }

    def "should update existing memo mapping if member differs"() {
        given:
        Member newMember = Member.builder().id(3L).firstName("Jane").lastName("Smith").build()
        def existingMatch = ZelleMemoMatch.builder()
                .member(testMember)
                .firstName("John")
                .lastName("Doe")
                .memo("shared memo")
                .build()

        memberRepository.findById(3L) >> Optional.of(newMember)
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.findByExternalId(_) >> Optional.empty()
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 14L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        zelleMemoMatchRepository.findByMemoIgnoreCase("shared memo") >> Optional.of(existingMatch)

        when:
        zelleService.createTransaction(
                "ext789", new BigDecimal("75.00"), LocalDate.now(),
                "shared memo", 3L, "donation", 2L)

        then:
        1 * zelleMemoMatchRepository.save({ ZelleMemoMatch m ->
            m.member.id == 3L && m.firstName == "Jane"
        })
    }

    // --- batchCreateFromMaps tests ---

    def "should batch create from maps successfully"() {
        given:
        def item = [
                external_id : "batch1",
                amount      : 100.00,
                payment_date: "2026-01-15",
                note        : "batch note",
                member_id   : 1L,
                payment_type: "donation"
        ] as Map<String, Object>

        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.findByExternalId("batch1") >> Optional.empty()
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 20L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def results = zelleService.batchCreateFromMaps([item], 2L)

        then:
        results.size() == 1
        results[0]["success"] == true
        results[0]["id"] == 20L
        results[0]["external_id"] == "batch1"
    }

    def "should handle duplicate in batch create"() {
        given:
        def item = [external_id: "dup1", amount: 50.00, payment_date: "2026-01-01"] as Map<String, Object>
        def existing = Transaction.builder().id(5L).externalId("dup1").build()

        transactionRepository.findByExternalId("dup1") >> Optional.of(existing)
        memberRepository.findById(2L) >> Optional.of(testCollector)

        when:
        def results = zelleService.batchCreateFromMaps([item], 2L)

        then:
        results.size() == 1
        results[0]["success"] == false
        results[0]["code"] == "EXISTS"
        results[0]["id"] == 5L
    }

    def "should handle general errors in batch create"() {
        given:
        def item = [external_id: "err1", amount: 10.00] as Map<String, Object>

        transactionRepository.findByExternalId("err1") >> Optional.empty()
        memberRepository.findById(2L) >> { throw new RuntimeException("DB error") }

        when:
        def results = zelleService.batchCreateFromMaps([item], 2L)

        then:
        results.size() == 1
        results[0]["success"] == false
        results[0]["message"] == "DB error"
    }

    def "should batch create with mixed success and failure"() {
        given:
        def item1 = [external_id: "ok1", amount: 100.00, payment_date: "2026-01-01"] as Map<String, Object>
        def item2 = [external_id: "dup2", amount: 50.00, payment_date: "2026-01-01"] as Map<String, Object>
        def existing = Transaction.builder().id(7L).externalId("dup2").build()

        transactionRepository.findByExternalId("ok1") >> Optional.empty()
        transactionRepository.findByExternalId("dup2") >> Optional.of(existing)
        memberRepository.findById(2L) >> Optional.of(testCollector)
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 30L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }

        when:
        def results = zelleService.batchCreateFromMaps([item1, item2], 2L)

        then:
        results.size() == 2
        results[0]["success"] == true
        results[1]["success"] == false
    }
}
