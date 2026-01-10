package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.BankTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface BankTransactionRepository extends JpaRepository<BankTransaction, Integer> {
        Optional<BankTransaction> findByTransactionHash(String transactionHash);

        Optional<BankTransaction> findTopByOrderByDateDesc();

        Optional<BankTransaction> findTopByBalanceNotNullOrderByDateDescIdAsc();

        @Query("SELECT SUM(bt.amount) FROM BankTransaction bt WHERE (bt.date > :date) OR (bt.date = :date AND bt.id < :id)")
        java.math.BigDecimal sumAmountNewerThan(@Param("date") LocalDate date, @Param("id") Integer id);

        @Query("SELECT bt FROM BankTransaction bt WHERE " +
                        "(bt.status = COALESCE(:status, bt.status)) " +
                        "AND (bt.type = COALESCE(:type, bt.type)) " +
                        "AND (bt.date >= COALESCE(:startDate, bt.date)) " +
                        "AND (bt.date <= COALESCE(:endDate, bt.date)) " +
                        "AND (LOWER(bt.description) LIKE LOWER(CONCAT('%', COALESCE(:description, ''), '%')))")
        Page<BankTransaction> findWithFilters(
                        @Param("status") BankTransaction.Status status,
                        @Param("type") String type,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("description") String description,
                        Pageable pageable);
}
