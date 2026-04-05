package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.MemberLoan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MemberLoanRepository extends JpaRepository<MemberLoan, Long> {

    @Query("SELECT ml FROM MemberLoan ml " +
            "LEFT JOIN FETCH ml.member m " +
            "LEFT JOIN FETCH ml.collector c " +
            "WHERE (:status IS NULL OR ml.status = :status) " +
            "AND (:memberId IS NULL OR m.id = :memberId) " +
            "AND (:startDate IS NULL OR ml.loanDate >= :startDate) " +
            "AND (:endDate IS NULL OR ml.loanDate <= :endDate)")
    Page<MemberLoan> findWithFilters(
            @Param("status") MemberLoan.Status status,
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("SELECT COALESCE(SUM(ml.outstandingBalance), 0) FROM MemberLoan ml WHERE ml.status IN :statuses")
    BigDecimal sumOutstandingBalanceByStatuses(@Param("statuses") List<MemberLoan.Status> statuses);

    long countByStatus(MemberLoan.Status status);

    @Query("SELECT COALESCE(SUM(ml.amount), 0) FROM MemberLoan ml")
    BigDecimal sumTotalLoanAmount();

    @Query("SELECT COUNT(DISTINCT ml.member.id) FROM MemberLoan ml WHERE ml.status IN :statuses")
    long countDistinctMembersByStatusIn(@Param("statuses") List<MemberLoan.Status> statuses);

    List<MemberLoan> findTop5ByOrderByCreatedAtDesc();
}
