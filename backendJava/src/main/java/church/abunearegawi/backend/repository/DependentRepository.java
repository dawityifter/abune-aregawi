package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Dependent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DependentRepository extends JpaRepository<Dependent, Long> {
    List<Dependent> findByMemberId(Long memberId);

    @org.springframework.data.jpa.repository.Query("SELECT d.member.id, COUNT(d) FROM Dependent d WHERE d.member.id IN :memberIds GROUP BY d.member.id")
    java.util.List<Object[]> countByMemberIds(@org.springframework.data.repository.query.Param("memberIds") java.util.List<Long> memberIds);
}
