package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.ExpenseCategory;
import church.abunearegawi.backend.repository.ExpenseCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExpenseCategoryService {

    private final ExpenseCategoryRepository expenseCategoryRepository;

    @Transactional(readOnly = true)
    public List<ExpenseCategory> findAll(boolean includeInactive) {
        if (includeInactive) {
            return expenseCategoryRepository.findAllByOrderByGlCodeAsc();
        }
        return expenseCategoryRepository.findByIsActiveTrueOrderByGlCodeAsc();
    }

    @Transactional(readOnly = true)
    public Optional<ExpenseCategory> findById(UUID id) {
        return expenseCategoryRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<ExpenseCategory> findByGlCode(String glCode) {
        return expenseCategoryRepository.findByGlCode(glCode.toUpperCase());
    }
}
