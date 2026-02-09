package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.VolunteerRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VolunteerRequestRepository extends JpaRepository<VolunteerRequest, Integer> {
    Page<VolunteerRequest> findByStatus(VolunteerRequest.Status status, Pageable pageable);
    Page<VolunteerRequest> findByMemberId(Long memberId, Pageable pageable);
}
