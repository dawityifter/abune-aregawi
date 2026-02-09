package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

        List<Transaction> findByMemberId(Long memberId);

        List<Transaction> findByPaymentDateBetween(LocalDate startDate, LocalDate endDate);

        Page<Transaction> findByPaymentType(Transaction.PaymentType paymentType, Pageable pageable);

        List<Transaction> findByPaymentType(Transaction.PaymentType paymentType);

        Page<Transaction> findByMemberId(Long memberId, Pageable pageable);

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

        boolean existsByExternalId(String externalId);

        Optional<Transaction> findByExternalId(String externalId);

        @Query(value = "SELECT CAST(receipt_number AS INTEGER) FROM transactions WHERE receipt_number ~ '^[0-9]+$' ORDER BY 1", nativeQuery = true)
        List<Integer> findAllReceiptNumbers();

        @Query("SELECT t FROM Transaction t LEFT JOIN FETCH t.member WHERE t.amount = :amount AND t.paymentDate BETWEEN :startDate AND :endDate AND t.externalId IS NULL")
        List<Transaction> findByAmountAndDateRange(
                        @Param("amount") java.math.BigDecimal amount,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);
}
