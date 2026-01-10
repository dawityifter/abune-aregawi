package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.ExpenseCategory;
import church.abunearegawi.backend.model.LedgerEntry;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.ExpenseCategoryRepository;
import church.abunearegawi.backend.repository.LedgerEntryRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Page<LedgerEntry> findExpenses(LocalDate startDate, LocalDate endDate, 
                                         String glCode, String paymentMethod, 
                                         Pageable pageable) {
        return ledgerEntryRepository.findExpenses("expense", startDate, endDate, glCode, paymentMethod, pageable);
    }

    @Transactional
    public LedgerEntry createExpense(LedgerEntry expense, Long collectedByMemberId) {
        // Validate required fields
        if (expense.getCategory() == null || expense.getAmount() == null || 
            expense.getEntryDate() == null || expense.getPaymentMethod() == null) {
            throw new RuntimeException("Missing required fields: category, amount, entryDate, paymentMethod");
        }

        // Validate amount
        if (expense.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Amount must be a positive number");
        }

        // Validate payment method
        String paymentMethod = expense.getPaymentMethod().toLowerCase();
        if (!paymentMethod.equals("cash") && !paymentMethod.equals("check")) {
            throw new RuntimeException("Payment method must be either 'cash' or 'check'");
        }

        // Validate expense date is not in the future
        if (expense.getEntryDate().isAfter(LocalDate.now())) {
            throw new RuntimeException("Expense date cannot be in the future");
        }

        // Validate GL code exists and is active
        ExpenseCategory category = expenseCategoryRepository.findByGlCode(expense.getCategory().toUpperCase())
                .orElseThrow(() -> new RuntimeException("Invalid or inactive GL code: " + expense.getCategory()));
        
        if (!category.isActive()) {
            throw new RuntimeException("GL code is inactive: " + expense.getCategory());
        }

        // Set collector
        if (collectedByMemberId != null) {
            Member collector = memberRepository.findById(collectedByMemberId)
                    .orElse(null);
            expense.setCollector(collector);
        }

        // Set type and source system
        expense.setType("expense");
        expense.setSourceSystem("manual");

        // Set default memo if not provided
        if (expense.getMemo() == null || expense.getMemo().trim().isEmpty()) {
            expense.setMemo(category.getName() + " expense");
        }

        return ledgerEntryRepository.save(expense);
    }

    @Transactional(readOnly = true)
    public Optional<LedgerEntry> findById(Long id) {
        return ledgerEntryRepository.findById(id);
    }
}

