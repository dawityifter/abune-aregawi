# backendJava/CLAUDE.md

**Status: WIP / experimental — NOT a working service.**

Gradle project that currently contains only tests (`src/test/java/church/abunearegawi`).
There is **no `src/main`** — no application code, and this service is not deployed or
wired into the frontend, CI/CD, or anything else. The active backend is `../backend/`
(Node/Express). Do not assume this project runs or serves traffic until `src/main`
exists.

`build/` and `.gradle/` contain stale build artifacts (classes, jacoco, spotless
reports) — ignore them.

## Gradle commands

```
./gradlew compileJava
./gradlew test
./gradlew build
./gradlew check
./gradlew spotlessCheck / spotlessApply    # formatting
./gradlew jacocoTestCoverageVerification   # coverage gate
```
