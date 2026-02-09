package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.DepartmentMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentMemberRepository extends JpaRepository<DepartmentMember, Long> {
    List<DepartmentMember> findByDepartmentId(Long departmentId);
    List<DepartmentMember> findByDepartmentIdAndStatus(Long departmentId, DepartmentMember.Status status);
    List<DepartmentMember> findByDepartmentIdAndRoleInDepartment(Long departmentId, String roleInDepartment);
    List<DepartmentMember> findByDepartmentIdAndStatusAndRoleInDepartment(Long departmentId, DepartmentMember.Status status, String roleInDepartment);
    Optional<DepartmentMember> findByDepartmentIdAndMemberId(Long departmentId, Long memberId);
    List<DepartmentMember> findByMemberId(Long memberId);
    long countByDepartmentIdAndStatus(Long departmentId, DepartmentMember.Status status);
}
