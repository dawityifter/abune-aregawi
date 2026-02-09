package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.ExpenseCreateRequest;
import church.abunearegawi.backend.dto.ExpenseDTO;
import church.abunearegawi.backend.model.Employee;
import church.abunearegawi.backend.model.ExpenseCategory;
import church.abunearegawi.backend.model.LedgerEntry;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Vendor;
import church.abunearegawi.backend.repository.EmployeeRepository;
import church.abunearegawi.backend.repository.ExpenseCategoryRepository;
import church.abunearegawi.backend.repository.LedgerEntryRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final MemberRepository memberRepository;
    private final EmployeeRepository employeeRepository;
    private final VendorRepository vendorRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> findExpenses(LocalDate startDate, LocalDate endDate,
                                            String glCode, String paymentMethod,
                                            Pageable pageable) {
        Page<LedgerEntry> page = ledgerEntryRepository.findExpenses("expense", startDate, endDate, glCode, paymentMethod, pageable);

        // Batch-load category names for all GL codes in the result
        Set<String> glCodes = page.getContent().stream()
                .map(LedgerEntry::getCategory)
                .filter(c -> c != null)
                .collect(Collectors.toSet());
        Map<String, ExpenseCategory> categoryMap = new LinkedHashMap<>();
        for (String code : glCodes) {
            expenseCategoryRepository.findByGlCode(code).ifPresent(cat -> categoryMap.put(code, cat));
        }

        List<ExpenseDTO> expenses = page.getContent().stream()
                .map(e -> toDTO(e, categoryMap))
                .collect(Collectors.toList());

        // Match Node.js response format
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", expenses);
        result.put("totalPages", page.getTotalPages());
        result.put("totalElements", page.getTotalElements());
        result.put("pagination", Map.of(
                "currentPage", page.getNumber() + 1,
                "totalPages", page.getTotalPages(),
                "totalItems", page.getTotalElements(),
                "itemsPerPage", page.getSize()
        ));
        return result;
    }

    @Transactional
    public ExpenseDTO createExpense(ExpenseCreateRequest request, Long collectedByMemberId) {
        if (request.getGlCode() == null || request.getAmount() == null ||
            request.getExpenseDate() == null || request.getPaymentMethod() == null) {
            throw new RuntimeException("Missing required fields: gl_code, amount, expense_date, payment_method");
        }

        if (request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Amount must be a positive number");
        }

        String paymentMethod = request.getPaymentMethod().toLowerCase();
        if (!paymentMethod.equals("cash") && !paymentMethod.equals("check")) {
            throw new RuntimeException("Payment method must be either 'cash' or 'check'");
        }

        LocalDate entryDate = LocalDate.parse(request.getExpenseDate());
        if (entryDate.isAfter(LocalDate.now())) {
            throw new RuntimeException("Expense date cannot be in the future");
        }

        ExpenseCategory category = expenseCategoryRepository.findByGlCode(request.getGlCode().toUpperCase())
                .orElseThrow(() -> new RuntimeException("Invalid or inactive GL code: " + request.getGlCode()));

        if (!category.isActive()) {
            throw new RuntimeException("GL code is inactive: " + request.getGlCode());
        }

        LedgerEntry expense = new LedgerEntry();
        expense.setCategory(request.getGlCode().toUpperCase());
        expense.setAmount(request.getAmount());
        expense.setEntryDate(entryDate);
        expense.setPaymentMethod(paymentMethod);
        expense.setReceiptNumber(request.getReceiptNumber());
        expense.setCheckNumber(request.getCheckNumber());
        expense.setInvoiceNumber(request.getInvoiceNumber());
        expense.setMemo(request.getMemo());
        expense.setPayeeName(request.getPayeeName());
        expense.setType("expense");
        expense.setSourceSystem("manual");

        if (collectedByMemberId != null) {
            memberRepository.findById(collectedByMemberId).ifPresent(expense::setCollector);
        }

        if (request.getEmployeeId() != null) {
            employeeRepository.findById(request.getEmployeeId()).ifPresent(expense::setEmployee);
        }

        if (request.getVendorId() != null) {
            vendorRepository.findById(request.getVendorId()).ifPresent(expense::setVendor);
        }

        if (expense.getMemo() == null || expense.getMemo().trim().isEmpty()) {
            expense.setMemo(category.getName() + " expense");
        }

        LedgerEntry saved = ledgerEntryRepository.save(expense);
        Map<String, ExpenseCategory> catMap = Map.of(saved.getCategory(), category);
        return toDTO(saved, catMap);
    }

    @Transactional(readOnly = true)
    public Optional<ExpenseDTO> findById(Long id) {
        return ledgerEntryRepository.findById(id).map(e -> toDTO(e, Map.of()));
    }

    private ExpenseDTO toDTO(LedgerEntry e, Map<String, ExpenseCategory> categoryMap) {
        String categoryName = null;
        String categoryDescription = null;
        ExpenseCategory cat = categoryMap.get(e.getCategory());
        if (cat != null) {
            categoryName = cat.getName();
            categoryDescription = cat.getDescription();
        } else if (e.getCategory() != null) {
            Optional<ExpenseCategory> lookup = expenseCategoryRepository.findByGlCode(e.getCategory());
            if (lookup.isPresent()) {
                categoryName = lookup.get().getName();
                categoryDescription = lookup.get().getDescription();
            }
        }

        Map<String, Object> employeeMap = null;
        Object employeeId = null;
        try {
            if (e.getEmployee() != null) {
                Employee emp = e.getEmployee();
                employeeId = emp.getId();
                employeeMap = new LinkedHashMap<>();
                employeeMap.put("id", emp.getId());
                employeeMap.put("first_name", emp.getFirstName());
                employeeMap.put("last_name", emp.getLastName());
                employeeMap.put("position", emp.getPosition());
            }
        } catch (Exception ignored) {
            // Lazy loading failed - leave as null
        }

        Map<String, Object> vendorMap = null;
        Object vendorId = null;
        try {
            if (e.getVendor() != null) {
                Vendor v = e.getVendor();
                vendorId = v.getId();
                vendorMap = new LinkedHashMap<>();
                vendorMap.put("id", v.getId());
                vendorMap.put("name", v.getName());
                vendorMap.put("vendor_type", v.getVendorType());
            }
        } catch (Exception ignored) {
            // Lazy loading failed - leave as null
        }

        Map<String, Object> collectorMap = null;
        Long collectedBy = null;
        try {
            if (e.getCollector() != null) {
                Member c = e.getCollector();
                collectedBy = c.getId();
                collectorMap = new LinkedHashMap<>();
                collectorMap.put("id", c.getId());
                collectorMap.put("first_name", c.getFirstName());
                collectorMap.put("last_name", c.getLastName());
                collectorMap.put("email", c.getEmail());
            }
        } catch (Exception ignored) {
            // Lazy loading failed - leave as null
        }

        Long memberId = null;
        try {
            if (e.getMember() != null) {
                memberId = e.getMember().getId();
            }
        } catch (Exception ignored) {
        }

        Long transactionId = null;
        try {
            if (e.getTransaction() != null) {
                transactionId = e.getTransaction().getId();
            }
        } catch (Exception ignored) {
        }

        return new ExpenseDTO(
                e.getId(),
                e.getType(),
                e.getCategory(),
                categoryName,
                categoryDescription,
                e.getAmount(),
                e.getEntryDate(),
                e.getPaymentMethod(),
                e.getReceiptNumber(),
                e.getMemo(),
                collectedBy,
                memberId,
                transactionId,
                e.getSourceSystem(),
                e.getExternalId(),
                e.getFund(),
                e.getAttachmentUrl(),
                e.getStatementDate(),
                employeeId,
                vendorId,
                e.getPayeeName(),
                e.getCheckNumber(),
                e.getInvoiceNumber(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                collectorMap,
                employeeMap,
                vendorMap
        );
    }
}
