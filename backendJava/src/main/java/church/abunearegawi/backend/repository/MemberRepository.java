package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MemberRepository
        extends JpaRepository<Member, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<Member> {

    Optional<Member> findByEmail(String email);

    Optional<Member> findByPhoneNumber(String phoneNumber);

    Optional<Member> findByFirebaseUid(String firebaseUid);

    java.util.List<Member> findByFamilyHeadId(Long familyHeadId);

    long countByRole(Member.Role role);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(m) FROM Member m WHERE m.familyHead IS NOT NULL")
    long countByFamilyHeadIsNotNull();

    org.springframework.data.domain.Page<Member> findByIsWelcomedFalseAndIsActiveTrue(
            org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(m.yearlyPledge) FROM Member m WHERE m.isActive = true")
    java.math.BigDecimal sumYearlyPledges();

    java.util.List<Member> findByIsActiveTrue();

    @org.springframework.data.jpa.repository.Query("SELECT m FROM Member m WHERE " +
            "LOWER(m.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(m.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(CONCAT(m.firstName, ' ', m.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(m.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "m.phoneNumber LIKE CONCAT('%', :query, '%')")
    java.util.List<Member> searchMembers(@org.springframework.data.repository.query.Param("query") String query);

    // Find by either email or phone number
    default Optional<Member> findByEmailOrPhone(String email, String phoneNumber) {
        if (email != null) {
            Optional<Member> member = findByEmail(email);
            if (member.isPresent()) {
                return member;
            }
        }
        if (phoneNumber != null) {
            return findByPhoneNumber(phoneNumber);
        }
        return Optional.empty();
    }
}
