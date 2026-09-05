package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Pledge;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PledgeRepository extends JpaRepository<Pledge, Long> {
    Page<Pledge> findByMemberId(Long memberId, Pageable pageable);

    /**
     * Pledges still owing money.
     *
     * <p>This replaces {@code findByStatus(Status.pending)}, which queried a
     * {@code status} column the pledges table does not have — every call failed
     * at runtime. The tempting repair, treating "pending" as
     * {@code lifecycle = 'active'}, is worse than the crash: it would sweep in
     * pledges that are fully paid, and the one caller sends payment reminders
     * by SMS. Texting members to pay what they have already paid is a real
     * harm, not a cosmetic bug.
     *
     * <p>So fulfilment is derived, the way the Node backend derives it: sum the
     * append-only allocations and compare with the amount promised. Reversals
     * are negative rows, so summing handles corrections for free. A pledge with
     * no allocations sums to null, hence the COALESCE.
     */
    @Query(value = """
            SELECT p.* FROM pledges p
            WHERE p.lifecycle = 'active'
              AND p.amount > COALESCE(
                    (SELECT SUM(a.amount) FROM pledge_allocations a WHERE a.pledge_id = p.id), 0)
            """, nativeQuery = true)
    java.util.List<Pledge> findOutstanding();

    /**
     * Pledges paid in full or beyond, by the same derivation as
     * {@link #findOutstanding()}. Replaces
     * {@code findByStatus(Status.fulfilled)}.
     */
    @Query(value = """
            SELECT p.* FROM pledges p
            WHERE p.lifecycle = 'active'
              AND p.amount <= COALESCE(
                    (SELECT SUM(a.amount) FROM pledge_allocations a WHERE a.pledge_id = p.id), 0)
            """, nativeQuery = true)
    java.util.List<Pledge> findFulfilled();

    /**
     * Total credited against one pledge, reversals included. Null when nothing
     * has been allocated yet.
     */
    @Query(value = "SELECT SUM(a.amount) FROM pledge_allocations a WHERE a.pledge_id = :pledgeId",
            nativeQuery = true)
    java.math.BigDecimal sumAllocatedFor(@Param("pledgeId") Long pledgeId);

    @Query("SELECT p FROM Pledge p WHERE " +
            "(:lifecycle IS NULL OR p.lifecycle = :lifecycle) " +
            "AND (:pledgeType IS NULL OR p.pledgeType = :pledgeType) " +
            "AND (:eventName IS NULL OR p.eventName = :eventName) " +
            "AND (:memberId IS NULL OR p.member.id = :memberId)")
    Page<Pledge> findWithFilters(
            @Param("lifecycle") String lifecycle,
            @Param("pledgeType") Pledge.PledgeType pledgeType,
            @Param("eventName") String eventName,
            @Param("memberId") Long memberId,
            Pageable pageable);
}
