package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.LedgerEntry;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {
        Page<LedgerEntry> findByType(String type, Pageable pageable);

        @Override
        @EntityGraph(attributePaths = { "employee", "vendor", "collector", "member", "transaction" })
        java.util.Optional<LedgerEntry> findById(Long id);

        @EntityGraph(attributePaths = { "employee", "vendor", "collector", "member", "transaction" })
        @Query("SELECT le FROM LedgerEntry le " +
                        "LEFT JOIN le.employee e " +
                        "LEFT JOIN le.vendor v " +
                        "WHERE le.type = :type " +
                        "AND le.entryDate >= COALESCE(:startDate, le.entryDate) " +
                        "AND le.entryDate <= COALESCE(:endDate, le.entryDate) " +
                        "AND le.category = COALESCE(:glCode, le.category) " +
                        "AND (:payee IS NULL OR LOWER(COALESCE(le.payeeName, '')) LIKE LOWER(CONCAT('%', :payee, '%')) " +
                        "OR LOWER(COALESCE(e.firstName, '')) LIKE LOWER(CONCAT('%', :payee, '%')) " +
                        "OR LOWER(COALESCE(e.lastName, '')) LIKE LOWER(CONCAT('%', :payee, '%')) " +
                        "OR LOWER(COALESCE(v.name, '')) LIKE LOWER(CONCAT('%', :payee, '%')))")
        Page<LedgerEntry> findExpenses(
                        @Param("type") String type,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("glCode") String glCode,
                        @Param("payee") String payee,
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

        @Query("SELECT DISTINCT YEAR(e.entryDate) FROM LedgerEntry e ORDER BY YEAR(e.entryDate) DESC")
        List<Integer> findDistinctYears();
}
