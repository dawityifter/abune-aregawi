package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Outreach;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OutreachRepository extends JpaRepository<Outreach, UUID> {
    List<Outreach> findByMemberIdOrderByWelcomedDateDescCreatedAtDesc(Long memberId);
}
