package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, UUID> {
    Optional<ExpenseCategory> findByGlCode(String glCode);
    java.util.List<ExpenseCategory> findByIsActiveTrueOrderByGlCodeAsc();
    java.util.List<ExpenseCategory> findAllByOrderByGlCodeAsc();
}

