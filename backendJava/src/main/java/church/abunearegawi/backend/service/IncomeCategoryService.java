package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.IncomeCategory;
import church.abunearegawi.backend.repository.IncomeCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class IncomeCategoryService {

    private final IncomeCategoryRepository incomeCategoryRepository;

    @Transactional(readOnly = true)
    public List<IncomeCategory> findAll(boolean activeOnly) {
        if (activeOnly) {
            return incomeCategoryRepository.findByIsActiveTrueOrderByDisplayOrderAscGlCodeAsc();
        }
        return incomeCategoryRepository.findAllByOrderByDisplayOrderAscGlCodeAsc();
    }

    @Transactional(readOnly = true)
    public Optional<IncomeCategory> findById(Long id) {
        return incomeCategoryRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<IncomeCategory> findByGlCode(String glCode) {
        return incomeCategoryRepository.findByGlCode(glCode);
    }

    @Transactional
    public IncomeCategory create(IncomeCategory category) {
        // Check if GL code already exists
        if (incomeCategoryRepository.findByGlCode(category.getGlCode()).isPresent()) {
            throw new RuntimeException("Income category with GL code " + category.getGlCode() + " already exists");
        }
        return incomeCategoryRepository.save(category);
    }

    @Transactional
    public IncomeCategory update(Long id, IncomeCategory category) {
        IncomeCategory existing = incomeCategoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Income category not found"));

        if (category.getName() != null) existing.setName(category.getName());
        if (category.getDescription() != null) existing.setDescription(category.getDescription());
        if (category.getPaymentTypeMapping() != null) existing.setPaymentTypeMapping(category.getPaymentTypeMapping());
        if (category.getDisplayOrder() != null) existing.setDisplayOrder(category.getDisplayOrder());
        existing.setActive(category.isActive());

        return incomeCategoryRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        IncomeCategory category = incomeCategoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Income category not found"));
        // Soft delete by setting is_active to false
        category.setActive(false);
        incomeCategoryRepository.save(category);
    }
}
