package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.MemberPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MemberPaymentRepository extends JpaRepository<MemberPayment, Integer> {

    List<MemberPayment> findByMemberId(UUID memberId);

    // Add lookup by phone
    List<MemberPayment> findByPhone1OrPhone2(String phone1, String phone2);

    List<MemberPayment> findByYear(Integer year);

    List<MemberPayment> findByMemberIdAndYear(UUID memberId, Integer year);

    @Query("SELECT SUM(mp.totalCollected) FROM MemberPayment mp WHERE mp.memberId = :memberId AND mp.year = :year")
    BigDecimal sumPaidByMemberAndYear(
            @Param("memberId") UUID memberId,
            @Param("year") Integer year);

    @Query("SELECT mp FROM MemberPayment mp WHERE (mp.phone1 = :phone OR mp.phone2 = :phone) AND mp.year = :year")
    Optional<MemberPayment> findByPhoneAndYear(@Param("phone") String phone, @Param("year") Integer year);

    @Query("SELECT SUM(mp.totalCollected) FROM MemberPayment mp WHERE mp.year = :year")
    BigDecimal sumPaidByYear(@Param("year") Integer year);
}
