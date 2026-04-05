package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Transaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {

        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        List<Transaction> findByMemberId(Long memberId);

        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        List<Transaction> findByPaymentDateBetween(LocalDate startDate, LocalDate endDate);

        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        Page<Transaction> findByPaymentType(Transaction.PaymentType paymentType, Pageable pageable);

        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        List<Transaction> findByPaymentType(Transaction.PaymentType paymentType);

        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        Page<Transaction> findByMemberId(Long memberId, Pageable pageable);

        @Override
        @EntityGraph(attributePaths = { "member", "collector", "incomeCategory", "donation" })
        Page<Transaction> findAll(org.springframework.data.jpa.domain.Specification<Transaction> spec, Pageable pageable);

        @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.paymentType = :paymentType AND t.paymentDate BETWEEN :startDate AND :endDate")
        BigDecimal sumByPaymentTypeAndDateRange(
                        @Param("paymentType") Transaction.PaymentType paymentType,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.member.id = :memberId AND t.paymentDate BETWEEN :startDate AND :endDate")
        BigDecimal sumByMemberAndDateRange(
                        @Param("memberId") Long memberId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.paymentDate BETWEEN :startDate AND :endDate")
        BigDecimal sumTotalByDateRange(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT t.member.id, SUM(t.amount) FROM Transaction t WHERE t.paymentDate BETWEEN :startDate AND :endDate AND t.member IS NOT NULL GROUP BY t.member.id")
        List<Object[]> sumAmountsByMemberAndDateRange(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        boolean existsByExternalId(String externalId);

        boolean existsByReceiptNumber(String receiptNumber);

        Optional<Transaction> findByExternalId(String externalId);

        @Query(value = "SELECT CAST(receipt_number AS INTEGER) FROM transactions WHERE receipt_number ~ '^[0-9]+$' ORDER BY 1", nativeQuery = true)
        List<Integer> findAllReceiptNumbers();

        @Query("SELECT t FROM Transaction t LEFT JOIN FETCH t.member WHERE t.amount = :amount AND t.paymentDate BETWEEN :startDate AND :endDate AND t.externalId IS NULL")
        List<Transaction> findByAmountAndDateRange(
                        @Param("amount") java.math.BigDecimal amount,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT t FROM Transaction t LEFT JOIN FETCH t.incomeCategory ic WHERE t.member.id IN :memberIds AND t.status = church.abunearegawi.backend.model.Transaction.Status.succeeded AND t.paymentDate >= :startDate AND t.paymentDate <= :endDate AND (ic.glCode IN :glCodes OR (ic IS NULL AND CAST(t.paymentType AS string) IN :paymentTypes)) ORDER BY t.paymentDate ASC")
        List<Transaction> findTaxDeductibleForHousehold(
                        @Param("memberIds") List<Long> memberIds,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("glCodes") List<String> glCodes,
                        @Param("paymentTypes") List<String> paymentTypes);
}
