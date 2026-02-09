package church.abunearegawi.backend.service

import church.abunearegawi.backend.model.BankTransaction
import church.abunearegawi.backend.model.IncomeCategory
import church.abunearegawi.backend.model.LedgerEntry
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.model.Transaction
import church.abunearegawi.backend.model.ZelleMemoMatch
import church.abunearegawi.backend.repository.BankTransactionRepository
import church.abunearegawi.backend.repository.IncomeCategoryRepository
import church.abunearegawi.backend.repository.LedgerEntryRepository
import church.abunearegawi.backend.repository.MemberRepository
import church.abunearegawi.backend.repository.TransactionRepository
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.web.multipart.MultipartFile
import spock.lang.Specification

import java.time.LocalDate

class BankTransactionServiceSpec extends Specification {

    BankTransactionRepository bankTransactionRepository = Mock()
    MemberRepository memberRepository = Mock()
    TransactionRepository transactionRepository = Mock()
    LedgerEntryRepository ledgerEntryRepository = Mock()
    MemberPaymentService memberPaymentService = Mock()
    ZelleMemoMatchRepository zelleMemoMatchRepository = Mock()
    IncomeCategoryRepository incomeCategoryRepository = Mock()

    BankTransactionService service = new BankTransactionService(
            bankTransactionRepository, memberRepository, transactionRepository,
            ledgerEntryRepository, memberPaymentService, zelleMemoMatchRepository,
            incomeCategoryRepository)

    Member testMember = Member.builder().id(1L).firstName("John").lastName("Doe").phoneNumber("+1234").build()
    Member testCollector = Member.builder().id(2L).firstName("Admin").lastName("User").build()

    // --- findAll ---

    def "should find all with filters"() {
        given:
        def pageable = PageRequest.of(0, 10)
        def txn = BankTransaction.builder().id(1).description("test").amount(new BigDecimal("100")).date(LocalDate.now()).transactionHash("h1").build()
        bankTransactionRepository.findWithFilters(BankTransaction.Status.PENDING, "ZELLE", null, null, null, pageable) >> new PageImpl<>([txn])

        when:
        def result = service.findAll(BankTransaction.Status.PENDING, "ZELLE", null, null, null, pageable)

        then:
        result.totalElements == 1
    }

    // --- findById ---

    def "should find by id"() {
        given:
        def txn = BankTransaction.builder().id(1).description("test").build()
        bankTransactionRepository.findById(1) >> Optional.of(txn)

        when:
        def result = service.findById(1)

        then:
        result.isPresent()
        result.get().id == 1
    }

    def "should return empty when not found by id"() {
        given:
        bankTransactionRepository.findById(999) >> Optional.empty()

        when:
        def result = service.findById(999)

        then:
        result.isEmpty()
    }

    // --- findByTransactionHash ---

    def "should find by transaction hash"() {
        given:
        def txn = BankTransaction.builder().id(1).transactionHash("abc123").build()
        bankTransactionRepository.findByTransactionHash("abc123") >> Optional.of(txn)

        when:
        def result = service.findByTransactionHash("abc123")

        then:
        result.isPresent()
    }

    // --- create ---

    def "should create bank transaction"() {
        given:
        def txn = BankTransaction.builder().transactionHash("new_hash").amount(new BigDecimal("50")).date(LocalDate.now()).description("test").build()
        bankTransactionRepository.findByTransactionHash("new_hash") >> Optional.empty()
        bankTransactionRepository.save(txn) >> txn

        when:
        def result = service.create(txn)

        then:
        result.transactionHash == "new_hash"
    }

    def "should throw on duplicate hash"() {
        given:
        def existing = BankTransaction.builder().id(1).transactionHash("dup_hash").build()
        def txn = BankTransaction.builder().transactionHash("dup_hash").build()
        bankTransactionRepository.findByTransactionHash("dup_hash") >> Optional.of(existing)

        when:
        service.create(txn)

        then:
        thrown(RuntimeException)
    }

    def "should create bank transaction with null hash"() {
        given:
        def txn = BankTransaction.builder().amount(new BigDecimal("50")).date(LocalDate.now()).description("no hash").build()
        bankTransactionRepository.save(txn) >> txn

        when:
        def result = service.create(txn)

        then:
        result.description == "no hash"
    }

    // --- getCurrentBalance ---

    def "should get current balance with anchor and newer sum"() {
        given:
        def anchor = BankTransaction.builder().id(1).date(LocalDate.of(2026, 1, 1)).balance(new BigDecimal("1000")).build()
        bankTransactionRepository.findTopByBalanceNotNullOrderByDateDescIdAsc() >> Optional.of(anchor)
        bankTransactionRepository.sumAmountNewerThan(anchor.date, anchor.id) >> new BigDecimal("500")

        when:
        def result = service.getCurrentBalance()

        then:
        result == new BigDecimal("1500")
    }

    def "should get current balance with no newer transactions"() {
        given:
        def anchor = BankTransaction.builder().id(1).date(LocalDate.of(2026, 1, 1)).balance(new BigDecimal("1000")).build()
        bankTransactionRepository.findTopByBalanceNotNullOrderByDateDescIdAsc() >> Optional.of(anchor)
        bankTransactionRepository.sumAmountNewerThan(_, _) >> null

        when:
        def result = service.getCurrentBalance()

        then:
        result == new BigDecimal("1000")
    }

    def "should return null when no anchor balance"() {
        given:
        bankTransactionRepository.findTopByBalanceNotNullOrderByDateDescIdAsc() >> Optional.empty()

        when:
        def result = service.getCurrentBalance()

        then:
        result == null
    }

    // --- update ---

    def "should update bank transaction status"() {
        given:
        def existing = BankTransaction.builder().id(1).status(BankTransaction.Status.PENDING).description("old").amount(new BigDecimal("100")).date(LocalDate.now()).transactionHash("h1").build()
        def updates = BankTransaction.builder().status(BankTransaction.Status.MATCHED).build()
        bankTransactionRepository.findById(1) >> Optional.of(existing)
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }

        when:
        def result = service.update(1, updates)

        then:
        result.status == BankTransaction.Status.MATCHED
    }

    def "should throw when updating non-existent transaction"() {
        given:
        bankTransactionRepository.findById(999) >> Optional.empty()

        when:
        service.update(999, BankTransaction.builder().build())

        then:
        thrown(RuntimeException)
    }

    // --- delete ---

    def "should delete bank transaction"() {
        when:
        service.delete(1)

        then:
        1 * bankTransactionRepository.deleteById(1)
    }

    // --- processUpload ---

    def "should process CSV upload"() {
        given:
        String csv = """Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/15/2026,Zelle payment from John Doe 12345,-100.00,DEBIT,5000.00,
CREDIT,01/16/2026,CHECK 1234,200.00,CREDIT,5200.00,1234"""

        MultipartFile file = Mock()
        file.getInputStream() >> new ByteArrayInputStream(csv.getBytes())
        bankTransactionRepository.findByTransactionHash(_) >> Optional.empty()
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }

        when:
        def result = service.processUpload(file)

        then:
        result["imported"] == 2
        result["skipped"] == 0
        result.containsKey("errors")
    }

    def "should skip duplicate rows in upload"() {
        given:
        String csv = """Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/15/2026,Zelle payment,-100.00,DEBIT,5000.00,"""

        MultipartFile file = Mock()
        file.getInputStream() >> new ByteArrayInputStream(csv.getBytes())
        def existing = BankTransaction.builder().id(1).balance(new BigDecimal("5000")).build()
        bankTransactionRepository.findByTransactionHash(_) >> Optional.of(existing)

        when:
        def result = service.processUpload(file)

        then:
        result["skipped"] == 1
        result["imported"] == 0
    }

    def "should update null balance on existing during upload"() {
        given:
        String csv = """Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/15/2026,Some txn,-100.00,DEBIT,5000.00,"""

        MultipartFile file = Mock()
        file.getInputStream() >> new ByteArrayInputStream(csv.getBytes())
        def existing = BankTransaction.builder().id(1).balance(null).build()
        bankTransactionRepository.findByTransactionHash(_) >> Optional.of(existing)
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }

        when:
        def result = service.processUpload(file)

        then:
        result["imported"] == 1
    }

    def "should handle CSV without header"() {
        given:
        String csv = """DEBIT,01/15/2026,Test description,-50.00,DEBIT,,"""

        MultipartFile file = Mock()
        file.getInputStream() >> new ByteArrayInputStream(csv.getBytes())
        bankTransactionRepository.findByTransactionHash(_) >> Optional.empty()
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }

        when:
        def result = service.processUpload(file)

        then:
        result["imported"] == 1
    }

    // --- reconcile ---

    def "should reconcile with IGNORE action"() {
        given:
        def bankTxn = BankTransaction.builder().id(1).status(BankTransaction.Status.PENDING).description("test").amount(new BigDecimal("100")).date(LocalDate.now()).transactionHash("h1").build()
        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }

        when:
        def result = service.reconcile(1, null, null, "IGNORE", null, null, null, null, null)

        then:
        result["message"] == "Transaction ignored"
        bankTxn.status == BankTransaction.Status.IGNORED
    }

    def "should reconcile with MATCH action creating new transaction"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("Zelle payment from John 99999")
                .amount(new BigDecimal("100")).date(LocalDate.of(2026, 1, 15))
                .transactionHash("hash1").type("ZELLE").build()

        def incomeCategory = IncomeCategory.builder().id(1L).glCode("INC001").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId("hash1") >> false
        incomeCategoryRepository.findByPaymentTypeMapping("donation") >> [incomeCategory]
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 10L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = service.reconcile(1, 1L, "donation", null, null, null, null, null, testCollector)

        then:
        result.containsKey("txn")
        result.containsKey("donation")
        bankTxn.status == BankTransaction.Status.MATCHED
    }

    def "should reconcile with existing transaction id"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("test").amount(new BigDecimal("100"))
                .date(LocalDate.now()).transactionHash("hash2").build()

        def existingTxn = Transaction.builder()
                .id(5L).amount(new BigDecimal("100"))
                .paymentType(Transaction.PaymentType.donation)
                .status(Transaction.Status.pending)
                .build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.findById(5L) >> Optional.of(existingTxn)
        transactionRepository.save(_ as Transaction) >> { Transaction t -> t }
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = service.reconcile(1, 1L, "donation", null, null, null, 5, null, testCollector)

        then:
        result.containsKey("txn")
        existingTxn.externalId == "hash2"
        existingTxn.status == Transaction.Status.succeeded
    }

    def "should reconcile with for_year override"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("test").amount(new BigDecimal("100"))
                .date(LocalDate.of(2026, 6, 15)).transactionHash("hash3").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId("hash3") >> false
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 11L
            // Verify the year was changed
            assert t.paymentDate.year == 2025
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = service.reconcile(1, 1L, "donation", null, null, null, null, 2025, testCollector)

        then:
        result.containsKey("donation")
    }

    def "should throw when reconciling already processed transaction"() {
        given:
        def bankTxn = BankTransaction.builder().id(1).status(BankTransaction.Status.MATCHED).build()
        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)

        when:
        service.reconcile(1, 1L, "donation", null, null, null, null, null, testCollector)

        then:
        thrown(RuntimeException)
    }

    def "should throw when reconciling non-existent bank transaction"() {
        given:
        bankTransactionRepository.findById(999) >> Optional.empty()

        when:
        service.reconcile(999, 1L, "donation", null, null, null, null, null, testCollector)

        then:
        thrown(RuntimeException)
    }

    def "should throw when no member id or existing id provided"() {
        given:
        def bankTxn = BankTransaction.builder().id(1).status(BankTransaction.Status.PENDING).build()
        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)

        when:
        service.reconcile(1, null, "donation", "MATCH", null, null, null, null, testCollector)

        then:
        thrown(RuntimeException)
    }

    def "should throw when collector is null for new transaction"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("test").amount(new BigDecimal("100"))
                .date(LocalDate.now()).transactionHash("hash4").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId("hash4") >> false
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []

        when:
        service.reconcile(1, 1L, "donation", null, null, null, null, null, null)

        then:
        thrown(RuntimeException)
    }

    def "should reconcile and recalculate member payment for membership_due"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("test").amount(new BigDecimal("100"))
                .date(LocalDate.of(2026, 3, 15)).transactionHash("hash5").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId("hash5") >> false
        incomeCategoryRepository.findByPaymentTypeMapping("membership_due") >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 15L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        service.reconcile(1, 1L, "membership_due", null, null, null, null, null, testCollector)

        then:
        1 * memberPaymentService.recalculateMemberPayment(1L, 2026)
    }

    def "should reconcile with CHECK type payment method"() {
        given:
        def bankTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("CHECK 1234").amount(new BigDecimal("100"))
                .date(LocalDate.now()).transactionHash("hash6").type("CHECK").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId("hash6") >> false
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 16L
            assert t.paymentMethod == Transaction.PaymentMethod.check
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        service.reconcile(1, 1L, "donation", null, null, null, null, null, testCollector)

        then:
        noExceptionThrown()
    }

    // --- batchReconcile ---

    def "should batch reconcile successfully"() {
        given:
        def bankTxn1 = BankTransaction.builder().id(1).status(BankTransaction.Status.PENDING).description("t1").amount(new BigDecimal("100")).date(LocalDate.now()).transactionHash("bh1").build()
        def bankTxn2 = BankTransaction.builder().id(2).status(BankTransaction.Status.PENDING).description("t2").amount(new BigDecimal("200")).date(LocalDate.now()).transactionHash("bh2").build()

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn1)
        bankTransactionRepository.findById(2) >> Optional.of(bankTxn2)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId(_) >> false
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 20L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = service.batchReconcile([1, 2] as List<Number>, 1L, "donation", null, testCollector)

        then:
        result["message"].contains("Success: 2")
        (result["success"] as List).size() == 2
        (result["errors"] as List).isEmpty()
    }

    def "should batch reconcile with partial failures"() {
        given:
        def bankTxn1 = BankTransaction.builder().id(1).status(BankTransaction.Status.PENDING).description("t1").amount(new BigDecimal("100")).date(LocalDate.now()).transactionHash("bh3").build()
        def bankTxn2 = BankTransaction.builder().id(2).status(BankTransaction.Status.MATCHED).build() // Already processed

        bankTransactionRepository.findById(1) >> Optional.of(bankTxn1)
        bankTransactionRepository.findById(2) >> Optional.of(bankTxn2)
        memberRepository.findById(1L) >> Optional.of(testMember)
        transactionRepository.existsByExternalId(_) >> false
        incomeCategoryRepository.findByPaymentTypeMapping(_) >> []
        transactionRepository.save(_ as Transaction) >> { Transaction t ->
            t.id = 21L
            return t
        }
        ledgerEntryRepository.save(_ as LedgerEntry) >> { LedgerEntry e -> e }
        bankTransactionRepository.save(_ as BankTransaction) >> { BankTransaction t -> t }
        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        zelleMemoMatchRepository.save(_ as ZelleMemoMatch) >> { ZelleMemoMatch m -> m }

        when:
        def result = service.batchReconcile([1, 2] as List<Number>, 1L, "donation", null, testCollector)

        then:
        result["message"].contains("Success: 1")
        result["message"].contains("Errors: 1")
    }

    // --- enrichTransactions ---

    def "should enrich PENDING transactions with suggestions"() {
        given:
        def pendingTxn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("Zelle payment from John Doe 12345")
                .amount(new BigDecimal("100")).date(LocalDate.of(2026, 1, 15))
                .transactionHash("eh1").build()
        def matchedTxn = BankTransaction.builder()
                .id(2).status(BankTransaction.Status.MATCHED)
                .description("matched txn").amount(new BigDecimal("200"))
                .date(LocalDate.now()).transactionHash("eh2").build()

        def memoMatch = ZelleMemoMatch.builder()
                .member(testMember).firstName("John").lastName("Doe")
                .memo("John Doe").build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.of(memoMatch)
        transactionRepository.findByAmountAndDateRange(_, _, _) >> []

        when:
        def result = service.enrichTransactions([pendingTxn, matchedTxn])

        then:
        result.size() == 2
        result[0].containsKey("suggested_match")
        !result[1].containsKey("suggested_match")
    }

    def "should enrich with no suggestions when no match found"() {
        given:
        def txn = BankTransaction.builder()
                .id(1).status(BankTransaction.Status.PENDING)
                .description("Unknown payment")
                .amount(new BigDecimal("100")).date(LocalDate.now())
                .transactionHash("eh3").build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        memberRepository.searchMembers(_) >> []
        transactionRepository.findByAmountAndDateRange(_, _, _) >> []

        when:
        def result = service.enrichTransactions([txn])

        then:
        result.size() == 1
        !result[0].containsKey("suggested_match")
        !result[0].containsKey("potential_matches")
    }

    // --- suggestMatch ---

    def "should suggest match via memo match"() {
        given:
        def txn = BankTransaction.builder()
                .description("Zelle payment from John Doe 12345")
                .build()
        def memoMatch = ZelleMemoMatch.builder()
                .member(testMember).firstName("John").lastName("Doe")
                .build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.of(memoMatch)

        when:
        def result = service.suggestMatch(txn)

        then:
        result != null
        result["type"] == "MEMO_MATCH"
        (result["member"] as Map)["id"] == 1L
    }

    def "should suggest match via fuzzy name from payer_name"() {
        given:
        def txn = BankTransaction.builder()
                .description("some payment")
                .payerName("John Doe")
                .build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        memberRepository.searchMembers("John Doe") >> [testMember]

        when:
        def result = service.suggestMatch(txn)

        then:
        result != null
        result["type"] == "FUZZY_NAME"
    }

    def "should suggest match via extracted name from Zelle description"() {
        given:
        def txn = BankTransaction.builder()
                .description("Zelle payment from Jane Smith 98765")
                .build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()
        memberRepository.searchMembers("Jane Smith") >> [Member.builder().id(3L).firstName("Jane").lastName("Smith").build()]

        when:
        def result = service.suggestMatch(txn)

        then:
        result != null
        result["type"] == "FUZZY_NAME"
    }

    def "should return null when no match found"() {
        given:
        def txn = BankTransaction.builder()
                .description("random text with no patterns")
                .build()

        zelleMemoMatchRepository.findByMemoIgnoreCase(_) >> Optional.empty()

        when:
        def result = service.suggestMatch(txn)

        then:
        result == null
    }

    def "should return null for null description"() {
        given:
        def txn = BankTransaction.builder().build()

        when:
        def result = service.suggestMatch(txn)

        then:
        result == null
    }

    // --- findPotentialMatches ---

    def "should find potential matches within date range"() {
        given:
        def bankTxn = BankTransaction.builder()
                .amount(new BigDecimal("-100.00"))
                .date(LocalDate.of(2026, 1, 15))
                .build()

        def sysTxn = Transaction.builder()
                .id(5L).amount(new BigDecimal("100.00"))
                .paymentDate(LocalDate.of(2026, 1, 16))
                .member(testMember)
                .build()

        transactionRepository.findByAmountAndDateRange(
                new BigDecimal("100.00"),
                LocalDate.of(2026, 1, 10),
                LocalDate.of(2026, 1, 20)) >> [sysTxn]

        when:
        def result = service.findPotentialMatches(bankTxn)

        then:
        result.size() == 1
        result[0]["id"] == 5L
        (result[0]["member"] as Map)["first_name"] == "John"
    }

    def "should return empty for null amount"() {
        given:
        def txn = BankTransaction.builder().date(LocalDate.now()).build()

        when:
        def result = service.findPotentialMatches(txn)

        then:
        result.isEmpty()
    }

    def "should return empty for null date"() {
        given:
        def txn = BankTransaction.builder().amount(new BigDecimal("100")).build()

        when:
        def result = service.findPotentialMatches(txn)

        then:
        result.isEmpty()
    }

    def "should find potential matches without member"() {
        given:
        def bankTxn = BankTransaction.builder()
                .amount(new BigDecimal("50.00"))
                .date(LocalDate.of(2026, 1, 15))
                .build()

        def sysTxn = Transaction.builder()
                .id(6L).amount(new BigDecimal("50.00"))
                .paymentDate(LocalDate.of(2026, 1, 14))
                .build() // no member

        transactionRepository.findByAmountAndDateRange(_, _, _) >> [sysTxn]

        when:
        def result = service.findPotentialMatches(bankTxn)

        then:
        result.size() == 1
        !result[0].containsKey("member")
    }
}
