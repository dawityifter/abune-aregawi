package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.DepartmentMeeting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DepartmentMeetingRepository extends JpaRepository<DepartmentMeeting, Long> {
    List<DepartmentMeeting> findByDepartmentId(Long departmentId);
}
