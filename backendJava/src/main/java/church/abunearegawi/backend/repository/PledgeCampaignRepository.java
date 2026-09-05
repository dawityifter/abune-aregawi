package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.PledgeCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PledgeCampaignRepository extends JpaRepository<PledgeCampaign, Long> {

    Optional<PledgeCampaign> findBySlug(String slug);

    /**
     * The one drive running right now, if any.
     *
     * <p>Live means active <em>and</em> inside the window. Status alone is not
     * enough: a campaign left active after its end date shows nothing to
     * members, and treating the two as equivalent is what lets an admin
     * "activate" a finished drive and see no effect.
     *
     * <p>Ordered newest-first and returned as a list so a caller can take the
     * first. The uniqueness rule is younger than the data, so it cannot fix
     * rows activated before it existed; if two somehow match, the public page
     * must still render rather than fail on a state an admin created.
     */
    @Query("""
            SELECT c FROM PledgeCampaign c
            WHERE c.status = 'active'
              AND c.startDate <= :today
              AND (c.endDate IS NULL OR c.endDate >= :today)
            ORDER BY c.startDate DESC
            """)
    List<PledgeCampaign> findLive(@Param("today") LocalDate today);

    /**
     * Active campaigns whose window overlaps the one given, excluding the
     * campaign being edited. A non-empty result is the reason to refuse an
     * activation: two live drives at once would make "the current campaign"
     * ambiguous for every pledge that follows.
     *
     * <p>A null end date is treated as running forever, so it overlaps anything
     * starting after it.
     */
    @Query("""
            SELECT c FROM PledgeCampaign c
            WHERE c.status = 'active'
              AND (:excludeId IS NULL OR c.id <> :excludeId)
              AND c.startDate <= COALESCE(:endDate, c.startDate)
              AND (c.endDate IS NULL OR c.endDate >= :startDate)
            """)
    List<PledgeCampaign> findOverlappingActive(@Param("excludeId") Long excludeId,
                                               @Param("startDate") LocalDate startDate,
                                               @Param("endDate") LocalDate endDate);
}
