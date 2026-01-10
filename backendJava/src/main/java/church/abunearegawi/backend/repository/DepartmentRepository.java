package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    // Changed from findByIsActive to findByActive (Java Bean naming convention for
    // boolean isActive)
    List<Department> findByActive(boolean isActive);

    Optional<Department> findByName(String name);

    List<Department> findByParentDepartmentId(Long parentId);

    @org.springframework.data.jpa.repository.Query("SELECT d FROM Department d JOIN d.memberships m WHERE m.member.id = :memberId")
    List<Department> findDepartmentsByMemberId(Long memberId);
}
