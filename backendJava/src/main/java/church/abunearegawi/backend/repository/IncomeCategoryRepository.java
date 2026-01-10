package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.IncomeCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IncomeCategoryRepository extends JpaRepository<IncomeCategory, Long> {
    Optional<IncomeCategory> findByGlCode(String glCode);
    java.util.List<IncomeCategory> findByIsActiveTrueOrderByDisplayOrderAscGlCodeAsc();
    java.util.List<IncomeCategory> findAllByOrderByDisplayOrderAscGlCodeAsc();
}

