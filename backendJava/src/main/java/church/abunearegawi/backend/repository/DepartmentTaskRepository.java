package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.DepartmentTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DepartmentTaskRepository extends JpaRepository<DepartmentTask, Long> {
    List<DepartmentTask> findByDepartmentId(Long departmentId);
}
