package church.abunearegawi.backend;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Diagnostic, not an assertion. Boots the context under the schemadiff profile
 * so Hibernate writes build/schema-gap.sql: every statement it would run to
 * reshape the database into the JPA entities' image. Each line is a place the
 * port disagrees with the schema the Node migrations own.
 */
@SpringBootTest
@ActiveProfiles("schemadiff")
class SchemaGapReportTest {

    @MockitoBean private FirebaseApp firebaseApp;
    @MockitoBean private FirebaseAuth firebaseAuth;

    @Test
    void writesTheGapReport() {
    }
}
