package church.abunearegawi.backend.support;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Base for tests that need the real Spring context and a real database.
 *
 * <p>Firebase is mocked rather than configured. {@code FirebaseConfig} throws
 * when {@code FIREBASE_SERVICE_ACCOUNT_BASE64} is absent, and that fail-fast is
 * correct in production — a backend that silently starts without token
 * verification is worse than one that refuses to start. Replacing the two beans
 * here keeps that behaviour intact instead of weakening it for the tests'
 * convenience, and avoids committing anything that looks like a service account.
 *
 * <p>The database is a throwaway built from a schema-only dump; see
 * {@code application-test.yml}. Hibernate runs with {@code ddl-auto: validate},
 * so any entity that has drifted from the schema the Node backend owns fails
 * the context before a single assertion runs.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    @MockitoBean
    protected FirebaseApp firebaseApp;

    @MockitoBean
    protected FirebaseAuth firebaseAuth;
}
