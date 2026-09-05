package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Member entity declared six columns the members table does not have —
 * allergies, dietary_restrictions, is_baptized, medical_conditions, medications
 * and notes. All six belong to Dependent, whose Node model defines them; the
 * port copied that block onto Member, and the stray comment "General notes about
 * member/dependent" is the fingerprint.
 *
 * <p>Nothing caught it because nothing ran a query. Hibernate names every column
 * in its SELECT, so the very first read of a member fails against the real
 * schema. This test is that first read.
 */
class MemberRepositorySchemaTest extends AbstractIntegrationTest {

    @Autowired
    private MemberRepository memberRepository;

    @Test
    void readsMembersAgainstTheRealSchema() {
        // The table is empty; that is fine. What matters is that the SELECT
        // Hibernate builds names only columns the Node migrations created.
        assertThat(memberRepository.findAll()).isEmpty();
    }

    @Test
    void countsMembersAgainstTheRealSchema() {
        assertThat(memberRepository.count()).isZero();
    }
}
