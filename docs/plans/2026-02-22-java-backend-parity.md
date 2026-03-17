# Java Backend Parity: Onboarding & Registration Fields

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the Java backend on par with Node.js for: pending welcomes familySize, welcomed members endpoint, and repentanceFather field in registration/listing.

**Architecture:** Add `familySize` computation to existing pending welcomes controller, create new `GET /api/members/onboarding/welcomed` endpoint with outreach note joins and welcomer name resolution, and wire `repentanceFather` through DTO/registration layers.

**Tech Stack:** Spring Boot 4.0.1, JPA/Hibernate, Spock (Groovy) tests, Gradle

---

### Task 1: Add `repentanceFather` to MemberDTO

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/dto/MemberDTO.java:14` (add field)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/dto/MemberDTO.java:83-118` (add to builder in fromEntity)

**Step 1: Add field and mapping**

In `MemberDTO.java`, add the field after `baptismName` (line 29):

```java
private String repentanceFather;
```

In `fromEntity()` builder chain (after `.baptismName(member.getBaptismName())` at line 97), add:

```java
.repentanceFather(member.getRepentanceFather())
```

**Step 2: Verify build compiles**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

**Step 3: Run existing tests to confirm no regressions**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/dto/MemberDTO.java
git commit -m "feat: add repentanceFather to MemberDTO"
```

---

### Task 2: Add `repentanceFather` to MemberCreateRequest and registration

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/dto/MemberCreateRequest.java:34` (add field)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java:102-119` (set field in register)

**Step 1: Add field to MemberCreateRequest**

In `MemberCreateRequest.java`, add after `country` field (line 34):

```java
private String repentanceFather;
```

**Step 2: Set field in MemberController.register()**

In `MemberController.java`, inside the `register` method, after `member.setFirebaseUid(request.getFirebaseUid());` (line 109), add:

```java
if (request.getRepentanceFather() != null)
    member.setRepentanceFather(request.getRepentanceFather());
```

Also add these missing registration fields that Node.js supports. After the repentanceFather line, add:

```java
if (request.getGender() != null) {
    try { member.setGender(Member.Gender.valueOf(request.getGender())); } catch (IllegalArgumentException ignored) {}
}
if (request.getMaritalStatus() != null) {
    try { member.setMaritalStatus(Member.MaritalStatus.valueOf(request.getMaritalStatus())); } catch (IllegalArgumentException ignored) {}
}
if (request.getStreetLine1() != null) member.setStreetLine1(request.getStreetLine1());
if (request.getCity() != null) member.setCity(request.getCity());
if (request.getState() != null) member.setState(request.getState());
if (request.getPostalCode() != null) member.setPostalCode(request.getPostalCode());
if (request.getCountry() != null) member.setCountry(request.getCountry());
```

**Step 3: Verify build compiles**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

**Step 4: Run tests**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/dto/MemberCreateRequest.java \
       backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java
git commit -m "feat: add repentanceFather to registration and additional create fields"
```

---

### Task 3: Add `familySize` to pending welcomes response

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java:208-244` (getOnboardingPending method)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/repository/DependentRepository.java` (add batch count query)
- Test: `backendJava/src/test/groovy/church/abunearegawi/backend/service/MemberServiceSpec.groovy`

**Step 1: Add batch dependent count to DependentRepository**

In `DependentRepository.java`, add this method:

```java
@org.springframework.data.jpa.repository.Query("SELECT d.member.id, COUNT(d) FROM Dependent d WHERE d.member.id IN :memberIds GROUP BY d.member.id")
java.util.List<Object[]> countByMemberIds(@org.springframework.data.repository.query.Param("memberIds") java.util.List<Long> memberIds);
```

**Step 2: Update getOnboardingPending in MemberController**

Inject `DependentRepository` into `MemberController`. Add field:

```java
private final church.abunearegawi.backend.repository.DependentRepository dependentRepository;
```

Replace the `getOnboardingPending` method body (lines 208-244) with:

```java
@GetMapping("/onboarding/pending")
@PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getOnboardingPending(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int limit) {
    Page<Member> members = memberService.findPendingWelcomes(
            org.springframework.data.domain.PageRequest.of(
                    Math.max(0, page - 1), limit,
                    org.springframework.data.domain.Sort.by("createdAt").descending()));

    // Batch-fetch dependent counts for all members on this page
    java.util.List<Long> memberIds = members.getContent().stream()
            .map(Member::getId).collect(java.util.stream.Collectors.toList());
    java.util.Map<Long, Long> depCounts = new java.util.HashMap<>();
    if (!memberIds.isEmpty()) {
        dependentRepository.countByMemberIds(memberIds)
                .forEach(row -> depCounts.put((Long) row[0], (Long) row[1]));
    }

    java.util.List<java.util.Map<String, Object>> memberList = members.getContent().stream()
            .map(m -> {
                int declaredSize = m.getHouseholdSize() != null ? m.getHouseholdSize() : 1;
                long depCount = depCounts.getOrDefault(m.getId(), 0L);
                int computedSize = 1 + (int) depCount;
                int familySize = Math.max(declaredSize, computedSize);

                java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("id", m.getId());
                item.put("firstName", m.getFirstName());
                item.put("lastName", m.getLastName());
                item.put("email", m.getEmail());
                item.put("phoneNumber", m.getPhoneNumber());
                item.put("createdAt", m.getCreatedAt());
                item.put("registrationStatus", m.getRegistrationStatus() != null ? m.getRegistrationStatus().name() : null);
                item.put("familySize", familySize);
                return item;
            })
            .collect(java.util.stream.Collectors.toList());

    java.util.Map<String, Object> pagination = new java.util.LinkedHashMap<>();
    pagination.put("currentPage", page);
    pagination.put("totalPages", members.getTotalPages());
    pagination.put("totalMembers", members.getTotalElements());
    pagination.put("hasNext", (long) page * limit < members.getTotalElements());
    pagination.put("hasPrev", page > 1);

    java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
    data.put("members", memberList);
    data.put("pagination", pagination);

    return ResponseEntity.ok(ApiResponse.success(data));
}
```

**Step 3: Verify build compiles**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

**Step 4: Run tests**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java \
       backendJava/src/main/java/church/abunearegawi/backend/repository/DependentRepository.java
git commit -m "feat: add familySize to pending welcomes response"
```

---

### Task 4: Add `getWelcomedMembers` endpoint

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/repository/MemberRepository.java` (add query)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/repository/OutreachRepository.java` (add batch query)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java` (add endpoint)
- Test: `backendJava/src/test/groovy/church/abunearegawi/backend/service/MemberServiceSpec.groovy`

**Step 1: Add repository methods**

In `MemberRepository.java`, add:

```java
org.springframework.data.domain.Page<Member> findByIsWelcomedTrueAndIsActiveTrue(
        org.springframework.data.domain.Pageable pageable);
```

In `OutreachRepository.java`, add:

```java
java.util.List<Outreach> findByMemberIdIn(java.util.List<Long> memberIds);
```

**Step 2: Add service method**

In `MemberService.java`, add (inject `OutreachRepository`):

First, add the new dependency. Change the constructor fields to include:

```java
private final OutreachRepository outreachRepository;
```

Then add the method:

```java
@Transactional(readOnly = true)
public Page<Member> findWelcomedMembers(Pageable pageable) {
    return memberRepository.findByIsWelcomedTrueAndIsActiveTrue(pageable);
}
```

**Step 3: Add controller endpoint**

In `MemberController.java`, after the `getOnboardingPending` method, add:

```java
@GetMapping("/onboarding/welcomed")
@PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getWelcomedMembers(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int limit) {
    Page<Member> members = memberService.findWelcomedMembers(
            org.springframework.data.domain.PageRequest.of(
                    Math.max(0, page - 1), limit,
                    org.springframework.data.domain.Sort.by("createdAt").descending()));

    java.util.List<Long> memberIds = members.getContent().stream()
            .map(Member::getId).collect(java.util.stream.Collectors.toList());

    // Batch-fetch dependent counts
    java.util.Map<Long, Long> depCounts = new java.util.HashMap<>();
    if (!memberIds.isEmpty()) {
        dependentRepository.countByMemberIds(memberIds)
                .forEach(row -> depCounts.put((Long) row[0], (Long) row[1]));
    }

    // Batch-fetch outreach notes
    java.util.Map<Long, java.util.List<church.abunearegawi.backend.model.Outreach>> outreachMap = new java.util.HashMap<>();
    if (!memberIds.isEmpty()) {
        java.util.List<church.abunearegawi.backend.model.Outreach> allNotes =
                memberService.findOutreachByMemberIds(memberIds);
        for (church.abunearegawi.backend.model.Outreach note : allNotes) {
            outreachMap.computeIfAbsent(note.getMember().getId(), k -> new java.util.ArrayList<>()).add(note);
        }
    }

    // Collect welcomer IDs that are numeric (member IDs)
    java.util.Set<Long> welcomerIds = new java.util.HashSet<>();
    outreachMap.values().forEach(notes -> {
        if (!notes.isEmpty()) {
            // Sort by welcomed_date desc, take latest
            notes.sort((a, b) -> b.getWelcomedDate().compareTo(a.getWelcomedDate()));
            String wb = notes.get(0).getWelcomedBy();
            try { welcomerIds.add(Long.parseLong(wb)); } catch (NumberFormatException ignored) {}
        }
    });

    // Batch-fetch welcomer names
    java.util.Map<Long, String> welcomerNames = new java.util.HashMap<>();
    if (!welcomerIds.isEmpty()) {
        memberService.findAllById(new java.util.ArrayList<>(welcomerIds))
                .forEach(w -> welcomerNames.put(w.getId(), w.getFirstName() + " " + w.getLastName()));
    }

    java.util.List<java.util.Map<String, Object>> memberList = members.getContent().stream()
            .map(m -> {
                int declaredSize = m.getHouseholdSize() != null ? m.getHouseholdSize() : 1;
                long depCount = depCounts.getOrDefault(m.getId(), 0L);
                int familySize = Math.max(declaredSize, 1 + (int) depCount);

                java.util.List<church.abunearegawi.backend.model.Outreach> notes =
                        outreachMap.getOrDefault(m.getId(), java.util.Collections.emptyList());
                church.abunearegawi.backend.model.Outreach latestNote = notes.isEmpty() ? null : notes.get(0);

                String welcomedBy = null;
                String welcomeNote = null;
                Object dateJoined = m.getCreatedAt();
                if (latestNote != null) {
                    String wb = latestNote.getWelcomedBy();
                    try {
                        Long wbId = Long.parseLong(wb);
                        welcomedBy = welcomerNames.getOrDefault(wbId, wb);
                    } catch (NumberFormatException e) {
                        welcomedBy = wb;
                    }
                    welcomeNote = latestNote.getNote();
                    dateJoined = latestNote.getWelcomedDate();
                }

                java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("id", m.getId());
                item.put("firstName", m.getFirstName());
                item.put("lastName", m.getLastName());
                item.put("email", m.getEmail());
                item.put("phoneNumber", m.getPhoneNumber());
                item.put("createdAt", m.getCreatedAt());
                item.put("dateJoined", dateJoined);
                item.put("familySize", familySize);
                item.put("welcomedBy", welcomedBy);
                item.put("welcomeNote", welcomeNote);
                return item;
            })
            .collect(java.util.stream.Collectors.toList());

    java.util.Map<String, Object> pagination = new java.util.LinkedHashMap<>();
    pagination.put("currentPage", page);
    pagination.put("totalPages", members.getTotalPages());
    pagination.put("totalMembers", members.getTotalElements());
    pagination.put("hasNext", (long) page * limit < members.getTotalElements());
    pagination.put("hasPrev", page > 1);

    java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
    data.put("members", memberList);
    data.put("pagination", pagination);

    return ResponseEntity.ok(ApiResponse.success(data));
}
```

**Step 4: Add helper methods to MemberService**

In `MemberService.java`, add these two methods:

```java
@Transactional(readOnly = true)
public java.util.List<church.abunearegawi.backend.model.Outreach> findOutreachByMemberIds(java.util.List<Long> memberIds) {
    return outreachRepository.findByMemberIdIn(memberIds);
}

@Transactional(readOnly = true)
public java.util.List<Member> findAllById(java.util.List<Long> ids) {
    return memberRepository.findAllById(ids);
}
```

**Step 5: Update MemberService constructor**

Since `MemberService` uses `@RequiredArgsConstructor`, simply add the field. The existing constructor:

```java
private final MemberRepository memberRepository;
private final DependentRepository dependentRepository;
```

Add after:

```java
private final OutreachRepository outreachRepository;
```

Also update the import at the top of `MemberService.java`:

```java
import church.abunearegawi.backend.repository.OutreachRepository;
```

**Step 6: Fix test - MemberServiceSpec constructor**

The Spock test constructs `MemberService` manually. Update line 20 in `MemberServiceSpec.groovy`:

```groovy
OutreachRepository outreachRepository = Mock()
MemberService service = new MemberService(memberRepository, dependentRepository, outreachRepository)
```

**Step 7: Add test for findWelcomedMembers**

In `MemberServiceSpec.groovy`, add before the closing `}`:

```groovy
// --- findWelcomedMembers ---

def "should find welcomed members"() {
    given:
    def pageable = PageRequest.of(0, 10)
    def welcomed = Member.builder().id(4L).firstName("Welcomed").lastName("Member").isWelcomed(true).isActive(true).build()
    memberRepository.findByIsWelcomedTrueAndIsActiveTrue(pageable) >> new PageImpl<>([welcomed])

    when:
    def result = service.findWelcomedMembers(pageable)

    then:
    result.totalElements == 1
    result.content[0].firstName == "Welcomed"
}
```

**Step 8: Verify build compiles**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew compileJava compileTestGroovy`
Expected: BUILD SUCCESSFUL

**Step 9: Run tests**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew test`
Expected: All tests pass

**Step 10: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/repository/MemberRepository.java \
       backendJava/src/main/java/church/abunearegawi/backend/repository/OutreachRepository.java \
       backendJava/src/main/java/church/abunearegawi/backend/service/MemberService.java \
       backendJava/src/main/java/church/abunearegawi/backend/controller/MemberController.java \
       backendJava/src/test/groovy/church/abunearegawi/backend/service/MemberServiceSpec.groovy
git commit -m "feat: add GET /api/members/onboarding/welcomed endpoint"
```

---

### Task 5: Final build verification

**Step 1: Full build**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew build`
Expected: BUILD SUCCESSFUL

**Step 2: Verify all tests pass**

Run: `cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew test`
Expected: All tests pass
