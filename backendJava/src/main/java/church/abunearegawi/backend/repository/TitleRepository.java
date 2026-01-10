package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Title;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TitleRepository extends JpaRepository<Title, Integer> {
    List<Title> findAllByOrderByPriorityAsc();
}
