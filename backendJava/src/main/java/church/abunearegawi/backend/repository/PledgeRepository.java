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
    
    @Query("SELECT p FROM Pledge p WHERE " +
           "(:status IS NULL OR p.status = :status) " +
           "AND (:pledgeType IS NULL OR p.pledgeType = :pledgeType) " +
           "AND (:eventName IS NULL OR p.eventName = :eventName) " +
           "AND (:memberId IS NULL OR p.member.id = :memberId)")
    Page<Pledge> findWithFilters(
            @Param("status") Pledge.Status status,
            @Param("pledgeType") Pledge.PledgeType pledgeType,
            @Param("eventName") String eventName,
            @Param("memberId") Long memberId,
            Pageable pageable
    );
}

