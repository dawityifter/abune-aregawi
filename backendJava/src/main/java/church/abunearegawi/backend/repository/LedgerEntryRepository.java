package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.LedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {
        Page<LedgerEntry> findByType(String type, Pageable pageable);

        @Query("SELECT le FROM LedgerEntry le WHERE le.type = :type " +
                        "AND le.entryDate >= COALESCE(:startDate, le.entryDate) " +
                        "AND le.entryDate <= COALESCE(:endDate, le.entryDate) " +
                        "AND le.category = COALESCE(:glCode, le.category) " +
                        "AND (le.paymentMethod = :paymentMethod OR :paymentMethod IS NULL)")
        Page<LedgerEntry> findExpenses(
                        @Param("type") String type,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("glCode") String glCode,
                        @Param("paymentMethod") String paymentMethod,
                        Pageable pageable);

        @Query("SELECT SUM(le.amount) FROM LedgerEntry le WHERE le.type = :type AND le.entryDate BETWEEN :startDate AND :endDate")
        java.math.BigDecimal sumByTypeAndDateRange(
                        @Param("type") String type,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT SUM(le.amount) FROM LedgerEntry le WHERE le.type <> :excludeType AND le.entryDate BETWEEN :startDate AND :endDate")
        java.math.BigDecimal sumByNotTypeAndDateRange(
                        @Param("excludeType") String excludeType,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT le.member.id, SUM(le.amount) FROM LedgerEntry le WHERE le.type = :type AND le.entryDate BETWEEN :startDate AND :endDate AND le.member IS NOT NULL GROUP BY le.member.id")
        java.util.List<Object[]> findMembershipDueSumsByMember(
                        @Param("type") String type,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);
}
