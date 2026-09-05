package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.PledgeAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Reads and inserts only.
 *
 * <p>A Postgres trigger blocks UPDATE and DELETE on pledge_allocations, so the
 * inherited {@code save} on an existing row and {@code delete} will fail at the
 * database. That is deliberate: corrections are new negative rows carrying a
 * reason, which preserves what was believed at the time. Do not add a method
 * here that tries to work around it.
 */
@Repository
public interface PledgeAllocationRepository extends JpaRepository<PledgeAllocation, Long> {

    List<PledgeAllocation> findByPledgeId(Long pledgeId);

    List<PledgeAllocation> findByTransactionId(Long transactionId);

    /**
     * Guards a webhook Stripe delivers more than once. Without this the second
     * delivery credits the same money twice, and because allocations are
     * append-only the duplicate cannot simply be deleted afterwards — it needs
     * a reversal, with all the explaining that entails.
     */
    Optional<PledgeAllocation> findByIdempotencyKey(String idempotencyKey);

    /**
     * Net amount credited against a pledge, reversals included, because a
     * reversal is a negative row. Null when nothing has been allocated.
     */
    @Query("SELECT SUM(a.amount) FROM PledgeAllocation a WHERE a.pledgeId = :pledgeId")
    java.math.BigDecimal sumForPledge(@Param("pledgeId") Long pledgeId);
}
