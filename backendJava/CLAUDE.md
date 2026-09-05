# backendJava/CLAUDE.md

**Status: WIP — compiles and tests green, but not deployed and not at parity.**

Spring Boot 4.0.1 on Java 25, Gradle 9.2.1. A port of the Node backend under
`../backend/`, which remains the only backend serving traffic.

Do not assume a capability exists here because it exists in Node. See
`../docs/java-parity-gaps.md` for what is missing, what is broken, and the
suggested order — it is kept current and is the first thing to read.

## The rule that matters most

**The schema belongs to Node.** `../backend/migrations/` holds 81 Sequelize
migrations and they are the single source of truth; they run automatically on
every deploy. Nothing here may create or alter a table.

Concretely: `spring.jpa.hibernate.ddl-auto` is `none` and must stay that way. It
was `update`, which lets Hibernate silently ALTER tables to match the JPA
entities on startup — no migration file, no review, no `SequelizeMeta` row.
Against the dev database that is invisible drift; against production it would
rewrite the parish's financial tables.

If an entity and the schema disagree, **the entity is wrong.**

## Testing

`AbstractIntegrationTest` boots the real context against a throwaway database
carrying the real schema and none of the parish's data. Rebuild it with:

```bash
pg_dump --schema-only --no-owner --no-privileges abune_aregawi > /tmp/s.sql
dropdb --if-exists abune_aregawi_java_test && createdb abune_aregawi_java_test
psql -q -d abune_aregawi_java_test -f /tmp/s.sql
```

Firebase is mocked there rather than configured: `FirebaseConfig` throws without
credentials, and that fail-fast is correct — a backend that starts without token
verification is worse than one that refuses to start.

**Anything touching persistence needs a test that reaches a database.** Every
Spock spec here mocks its repository, which is why three defects that broke
entire categories of operation went unnoticed: an entity mapping six columns
that do not exist, another missing a NOT NULL column, and 15 fields binding
Postgres enums as varchar. Mocks cannot see any of those.

`SchemaGapReportTest` is the gate: it fails if any entity declares a column no
table has. Keep it at zero.

## Gradle commands

```
./gradlew compileJava
./gradlew test
./gradlew build
./gradlew check
./gradlew spotlessCheck / spotlessApply    # formatting
./gradlew jacocoTestCoverageVerification   # coverage gate
```

Gradle caches aggressively; add `--rerun-tasks` when a test needs to run again
without a source change (regenerating the schema gap report, for instance).

## Conventions

- Responses wrap in `ApiResponse<T>`: `{ success, message, data }`
- A servlet filter turns a Firebase token into `FirebaseUserDetails`
- Roles via `@PreAuthorize` with upper-case names: `hasAnyRole('ADMIN', 'TREASURER')`
- Entities use Lombok `@Builder`, `@Getter`, `@Setter`
- A field mapping one of the schema's 23 Postgres enum columns needs
  `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`, or every write to that table fails
