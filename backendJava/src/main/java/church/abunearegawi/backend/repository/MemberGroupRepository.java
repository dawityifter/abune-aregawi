package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.MemberGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberGroupRepository extends JpaRepository<MemberGroup, Long> {

    @Query("SELECT mg.group.id, COUNT(mg) FROM MemberGroup mg GROUP BY mg.group.id")
    List<Object[]> countMembersPerGroup();

    List<MemberGroup> findByGroupId(Long groupId);
}
