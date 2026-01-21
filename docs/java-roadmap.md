# Java Backend Parity & Migration Roadmap

This document outlines the strategic plan to bring the `backendJava` (Spring Boot) on par with the existing Node.js `backend`, achieve 90% test coverage using Groovy/Spock, and ensure long-term maintainability during the transition period.

## 🎯 Objectives
1.  **100% Feature Parity**: Complete functional equivalence between Node.js and Java backends.
2.  **90% Code Coverage**: Comprehensive test suite using Spock Framework & Groovy.
3.  **Seamless Integration**: Zero breakage for frontend during the transition.
4.  **Dual-Stack Maintenance**: Strict protocol for keeping both backends in sync.

---

## 📅 Roadmap Phases

### ✅ Phase 1-4: Core Feature Implementation (Completed)
- **Infrastructure**: Google Drive, Gallery, SMS (Twilio).
- **Business Logic**: Zelle Integration, Member Payments, Transaction handling.
- **Entity Management**: Groups, Members, Departments.
- **Reporting**: Financial reports and logic.

### 🚧 Phase 5: Verification & Gap Analysis (Immediate)
Before aggressive testing, we must ensure no subtle "unknown unknowns" remain.
- [ ] **Full API Audit**: Compare every route in `backend/src/routes` vs `backendJava` controllers.
- [ ] **Error Handling Parity**: Ensure Java error responses (400/404/500) match Node.js JSON structure exactly for frontend compatibility.
- [ ] **Role/Permission Verification**: Audit `@PreAuthorize` annotations against Node.js middleware.

### 🧪 Phase 6: Comprehensive Testing Suite (The 90% Goal)
We will use **Groovy & Spock** for expressive, BDD-style testing.

#### 6.1 Testing Infrastructure
- [ ] Configure **Jacoco** gradle plugin to enforce 90% coverage verification.
- [ ] Set up `BaseSpecification` class for shared test configuration.

#### 6.2 Test Layers
1.  **Unit Tests (Services)**:
    - Mock repositories and external services (Google/Twilio).
    - Cover all edge cases (null inputs, business rule violations).
    - *Goal*: 100% coverage of Service layer.
2.  **Integration Tests (Controllers)**:
    - Use `MockMvc` to test HTTP endpoints.
    - Verify JSON serialization/deserialization (snake_case vs camelCase).
    - Verify Security/Auth logic (Role access).
3.  **Repository Tests**:
    - Use H2 in-memory DB or Testcontainers to verify complex JPA queries.

#### 6.3 Critical Test Modules
- `MemberServiceSpec`: Registration, Role updates (multi-role), Dependents.
- `TransactionServiceSpec`: Payment processing, logic checks.
- `ZelleServiceSpec`: Regex parsing for memos, batch creation logic.

### 🔄 Phase 7: Dual-Backend Maintenance Protocol
To prevent "drift" where one backend gets ahead of the other.

#### The "Simultaneous Update" Rule
> **Rule**: Any change requiring a backend update MUST be applied to BOTH Node.js and Java versions immediately.

**Workflow for New Features:**
1.  **Frontend Change**: Implement UI change.
2.  **Node.js Update**: Update existing backend to support feature (ensure backward compatibility).
3.  **Verification**: Test frontend with Node.js.
4.  **Java Implementation**: Port logic *immediately* to Java.
5.  **Parity Check**: Verify frontend works identically with Java backend.
6.  **Test Coverage**: Write Spock test for new Java code before marking complete.

#### CI/CD Checks
- If possible, run frontend E2E tests against *both* backends in CI pipeline.

---

## 🛠 Technical Standards

### Testing (Spock)
```groovy
def "should register member successfully"() {
    given: "A valid registration request"
    def request = new MemberCreateRequest(firstName: "John", ...)

    when: "The register service is called"
    def result = memberService.register(request)

    then: "The member is saved"
    1 * memberRepository.save(_) >> { Member m -> m }
    result.firstName == "John"
}
```

### Code Coverage
- **Metric**: Line & Branch coverage.
- **Threshold**: 90% minimum.
- **Exclusions**: DTOs, Configuration classes (pure boilerplate).

---

## 📦 Progress Tracking
We will track progress in `task.md` and use specific `gap-analysis.md` artifacts to list identified discrepancies.
