package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Pledge;
import church.abunearegawi.backend.model.PledgeAllocation;
import church.abunearegawi.backend.model.PledgeCampaign;
import church.abunearegawi.backend.model.Transaction;
import church.abunearegawi.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fulfilment is derived, never stored — the property the whole pledge design
 * rests on. These run against the real schema with real rows, so they also
 * prove the three entities map tables that exist: before this, Pledge mapped a
 * {@code status} column that does not exist and omitted {@code campaign_id},
 * which is NOT NULL, so it could neither read nor write a pledge.
 */
@Transactional
class PledgeFulfillmentDerivationTest extends AbstractIntegrationTest {

    @Autowired private PledgeRepository pledgeRepository;
    @Autowired private PledgeCampaignRepository campaignRepository;
    @Autowired private PledgeAllocationRepository allocationRepository;
    @Autowired private MemberRepository memberRepository;
    @Autowired private TransactionRepository transactionRepository;

    private PledgeCampaign campaign;
    private Member member;
    /** Allocations carry a real FK to transactions, so the fixture needs one. */
    private Transaction transaction;

    @BeforeEach
    void setUp() {
        campaign = campaignRepository.save(PledgeCampaign.builder()
                .slug("test-drive-" + System.nanoTime())
                .name("Test Drive")
                .startDate(LocalDate.now().minusDays(10))
                .endDate(LocalDate.now().plusDays(30))
                .status(PledgeCampaign.STATUS_ACTIVE)
                .build());

        member = memberRepository.save(Member.builder()
                .firstName("Derivation")
                .lastName("Fixture")
                .phoneNumber("+1555000" + (System.nanoTime() % 10000))
                .role(Member.Role.member)
                .build());

        transaction = transactionRepository.save(Transaction.builder()
                .member(member)
                .collector(member)
                .amount(new java.math.BigDecimal("500.00"))
                .paymentType(Transaction.PaymentType.donation)
                // Not cash or check: check_receipt_for_cash_check requires a
                // receipt number for those, and an online gift has none.
                .paymentMethod(Transaction.PaymentMethod.credit_card)
                .build());
    }

    private Pledge pledgeOf(String amount) {
        return pledgeRepository.save(Pledge.builder()
                .campaign(campaign)
                .member(member)
                .amount(new BigDecimal(amount))
                .firstName("Derivation")
                .lastName("Fixture")
                .build());
    }

    private void allocate(Pledge pledge, String amount) {
        allocationRepository.save(PledgeAllocation.builder()
                .pledgeId(pledge.getId())
                .transactionId(transaction.getId())
                .amount(new BigDecimal(amount))
                .source("treasurer_manual")
                .build());
    }

    @Test
    void aPledgeWithNoPaymentsIsOutstanding() {
        Pledge pledge = pledgeOf("500.00");

        assertThat(pledgeRepository.findOutstanding()).extracting(Pledge::getId).contains(pledge.getId());
        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).doesNotContain(pledge.getId());
    }

    @Test
    void aPartlyPaidPledgeIsStillOutstanding() {
        Pledge pledge = pledgeOf("500.00");
        allocate(pledge, "200.00");

        assertThat(pledgeRepository.findOutstanding()).extracting(Pledge::getId).contains(pledge.getId());
    }

    @Test
    void aPledgePaidToTheLastCentIsFulfilled() {
        Pledge pledge = pledgeOf("500.00");
        allocate(pledge, "500.00");

        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).contains(pledge.getId());
        assertThat(pledgeRepository.findOutstanding()).extracting(Pledge::getId).doesNotContain(pledge.getId());
    }

    @Test
    void severalPaymentsAddUp() {
        Pledge pledge = pledgeOf("500.00");
        allocate(pledge, "200.00");
        allocate(pledge, "300.00");

        assertThat(pledgeRepository.sumAllocatedFor(pledge.getId())).isEqualByComparingTo("500.00");
        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).contains(pledge.getId());
    }

    /**
     * The reason corrections are negative rows rather than edits: a reversal
     * has to move the pledge back to outstanding without erasing the record of
     * the payment that was believed to have arrived.
     */
    @Test
    void reversingAPaymentMakesThePledgeOutstandingAgain() {
        Pledge pledge = pledgeOf("500.00");
        allocate(pledge, "500.00");
        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).contains(pledge.getId());

        allocationRepository.save(PledgeAllocation.builder()
                .pledgeId(pledge.getId())
                .transactionId(transaction.getId())
                .amount(new BigDecimal("-500.00"))
                .source("treasurer_manual")
                .reason("cheque returned unpaid")
                .build());

        assertThat(pledgeRepository.sumAllocatedFor(pledge.getId())).isEqualByComparingTo("0.00");
        assertThat(pledgeRepository.findOutstanding()).extracting(Pledge::getId).contains(pledge.getId());
        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).doesNotContain(pledge.getId());

        // The original row survives the correction — that is the point.
        List<PledgeAllocation> rows = allocationRepository.findByPledgeId(pledge.getId());
        assertThat(rows).hasSize(2);
    }

    @Test
    void overpaymentCountsAsFulfilled() {
        Pledge pledge = pledgeOf("500.00");
        allocate(pledge, "600.00");

        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).contains(pledge.getId());
    }

    /**
     * A cancelled pledge is neither owed nor fulfilled: it should not appear in
     * a reminder list, and it should not inflate what the drive collected.
     */
    @Test
    void aCancelledPledgeIsInNeitherList() {
        Pledge pledge = pledgeOf("500.00");
        pledge.setLifecycle("cancelled");
        pledgeRepository.saveAndFlush(pledge);

        assertThat(pledgeRepository.findOutstanding()).extracting(Pledge::getId).doesNotContain(pledge.getId());
        assertThat(pledgeRepository.findFulfilled()).extracting(Pledge::getId).doesNotContain(pledge.getId());
    }

    @Test
    void anAnonymousPledgeCarriesItsOwnIdentifier() {
        Pledge pledge = pledgeRepository.save(Pledge.builder()
                .campaign(campaign)
                .amount(new BigDecimal("100.00"))
                .firstName("Anonymous")
                .lastName("Giver")
                .isAnonymous(true)
                .fulfillmentIntent("immediate")
                .baptismName("Gabriel")
                .build());

        Pledge reloaded = pledgeRepository.findById(pledge.getId()).orElseThrow();
        assertThat(reloaded.getIsAnonymous()).isTrue();
        assertThat(reloaded.getBaptismName()).isEqualTo("Gabriel");
        assertThat(reloaded.getMember()).isNull();
    }
}
