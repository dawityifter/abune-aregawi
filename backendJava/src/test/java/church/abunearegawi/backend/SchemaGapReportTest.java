package church.abunearegawi.backend;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The parity gate at the persistence layer.
 *
 * <p>Boots under the schemadiff profile, where Hibernate writes the DDL it
 * would run to reshape the database into the entities' image, executing
 * nothing. Every statement is a place the port disagrees with the schema the
 * Node backend's Sequelize migrations own.
 *
 * <p>Only <em>structural</em> disagreements fail the build — a column an entity
 * declares that no table has. Those are not stylistic: Hibernate names every
 * column in its SELECT, so one of them breaks every read of that table at
 * runtime, which is exactly how Member came to be unqueryable while its unit
 * tests passed against a mock.
 *
 * <p>Column <em>type</em> differences are reported but tolerated. There are 37,
 * nearly all varchar(255) against a shorter varchar, and Hibernate reads and
 * writes them correctly. Narrowing them is worth doing — it would let
 * application-test.yml move from {@code ddl-auto: none} to {@code validate} and
 * make this whole class redundant — but it is tidying, not a defect.
 */
@SpringBootTest
@ActiveProfiles("schemadiff")
class SchemaGapReportTest {

    private static final Path REPORT = Path.of("build/schema-gap.sql");

    private static final Pattern STRUCTURAL =
            Pattern.compile("(?i)^(alter table if exists \\w+\\s+add column|create table ).*");

    @MockitoBean private FirebaseApp firebaseApp;
    @MockitoBean private FirebaseAuth firebaseAuth;

    @Test
    void noEntityDeclaresAColumnTheSchemaDoesNotHave() throws IOException {
        assertThat(REPORT)
                .as("Hibernate should have written the gap report; if it is missing the "
                        + "schemadiff profile is not generating scripts any more")
                .exists();

        List<String> structural = statements().stream()
                .filter(s -> STRUCTURAL.matcher(s).matches())
                .distinct()
                .collect(Collectors.toList());

        assertThat(structural)
                .as("""
                        Each line is a column an entity declares that no table has, so any \
                        query touching that table fails at runtime. Fix the entity — the 81 \
                        Sequelize migrations under backend/migrations are the source of truth \
                        for the schema, and this port must not add columns of its own.""")
                .isEmpty();
    }

    private List<String> statements() throws IOException {
        return Arrays.stream(Files.readString(REPORT).split(";"))
                .map(s -> String.join(" ", s.trim().split("\\s+")))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }
}
