package church.abunearegawi.backend.service

import church.abunearegawi.backend.dto.MemberDTO
import church.abunearegawi.backend.dto.MemberUpdateRequest
import church.abunearegawi.backend.model.Dependent
import church.abunearegawi.backend.model.Member
import church.abunearegawi.backend.repository.DependentRepository
import church.abunearegawi.backend.repository.MemberRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import spock.lang.Specification

import java.time.LocalDate

class MemberServiceSpec extends Specification {

    MemberRepository memberRepository = Mock()
    DependentRepository dependentRepository = Mock()
    MemberService service = new MemberService(memberRepository, dependentRepository)

    Member testMember = Member.builder()
            .id(1L).firstName("John").lastName("Doe")
            .email("john@test.com").phoneNumber("+11234567890")
            .role(Member.Role.member).isActive(true)
            .build()

    // --- findByEmailOrPhone ---

    def "should find member by phone"() {
        given:
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember)

        when:
        def result = service.findByEmailOrPhone("any@email.com", "11234567890")

        then:
        result.isPresent()
        result.get().id == 1L
    }

    def "should normalize phone with plus prefix"() {
        given:
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember)

        when:
        def result = service.findByEmailOrPhone(null, "+11234567890")

        then:
        result.isPresent()
    }

    def "should return empty when phone is null"() {
        when:
        def result = service.findByEmailOrPhone("email@test.com", null)

        then:
        result.isEmpty()
    }

    def "should return empty when phone is empty"() {
        when:
        def result = service.findByEmailOrPhone(null, "")

        then:
        result.isEmpty()
    }

    // --- findByFirebaseInfo ---

    def "should find by firebase uid"() {
        given:
        memberRepository.findByFirebaseUid("uid123") >> Optional.of(testMember)

        when:
        def result = service.findByFirebaseInfo("uid123", null, null)

        then:
        result.isPresent()
        result.get().id == 1L
    }

    def "should fallback to phone when uid not found"() {
        given:
        memberRepository.findByFirebaseUid("uid999") >> Optional.empty()
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember)

        when:
        def result = service.findByFirebaseInfo("uid999", null, "11234567890")

        then:
        result.isPresent()
    }

    def "should return empty when uid is null and phone is null"() {
        when:
        def result = service.findByFirebaseInfo(null, null, null)

        then:
        result.isEmpty()
    }

    // --- findById ---

    def "should find member by id"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)

        when:
        def result = service.findById(1L)

        then:
        result.isPresent()
    }

    // --- findAll ---

    def "should find all members paginated"() {
        given:
        def pageable = PageRequest.of(0, 10)
        memberRepository.findAll(pageable) >> new PageImpl<>([testMember])

        when:
        def result = service.findAll(pageable)

        then:
        result.totalElements == 1
    }

    // --- search ---

    def "should return empty for short query"() {
        when:
        def result = service.search("ab")

        then:
        result.isEmpty()
    }

    def "should return empty for null query"() {
        when:
        def result = service.search(null)

        then:
        result.isEmpty()
    }

    def "should search members by name"() {
        given:
        memberRepository.findAll(_, _) >> new PageImpl<>([testMember])

        when:
        def result = service.search("John Doe")

        then:
        result.size() == 1
        result[0].firstName == "John"
    }

    def "should limit search tokens to 5"() {
        given:
        memberRepository.findAll(_, _) >> new PageImpl<>([testMember])

        when:
        def result = service.search("one two three four five six seven")

        then:
        result.size() == 1 // Still works, just limits tokens
    }

    def "should search by phone number"() {
        given:
        memberRepository.findAll(_, _) >> new PageImpl<>([testMember])

        when:
        def result = service.search("1234567890")

        then:
        result.size() == 1
    }

    // --- findAllList ---

    def "should find all list with limit"() {
        given:
        memberRepository.findAll(_ as org.springframework.data.domain.Pageable) >> new PageImpl<>([testMember])

        when:
        def result = service.findAllList(100)

        then:
        result.size() == 1
    }

    // --- register ---

    def "should register new member"() {
        given:
        def newMember = Member.builder().firstName("New").lastName("User").email("new@test.com").build()
        memberRepository.findByEmail("new@test.com") >> Optional.empty()
        memberRepository.save(newMember) >> newMember

        when:
        def result = service.register(newMember)

        then:
        result.firstName == "New"
    }

    def "should throw on duplicate email"() {
        given:
        def newMember = Member.builder().email("existing@test.com").build()
        memberRepository.findByEmail("existing@test.com") >> Optional.of(testMember)

        when:
        service.register(newMember)

        then:
        thrown(RuntimeException)
    }

    def "should register member with null email"() {
        given:
        def newMember = Member.builder().firstName("NoEmail").build()
        memberRepository.save(newMember) >> newMember

        when:
        def result = service.register(newMember)

        then:
        result.firstName == "NoEmail"
    }

    // --- getDependents ---

    def "should get dependents for family head"() {
        given:
        def dep = Member.builder().id(2L).firstName("Child").lastName("Doe").role(Member.Role.dependent).familyHead(testMember).build()
        memberRepository.findByFamilyHeadId(1L) >> [dep]

        when:
        def result = service.getDependents(1L)

        then:
        result.size() == 1
        result[0].firstName == "Child"
    }

    // --- findDependentById ---

    def "should find dependent by id"() {
        given:
        def dep = Member.builder().id(2L).firstName("Child").role(Member.Role.dependent).build()
        memberRepository.findById(2L) >> Optional.of(dep)

        when:
        def result = service.findDependentById(2L)

        then:
        result.isPresent()
    }

    def "should not find non-dependent as dependent"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember) // role=member, not dependent

        when:
        def result = service.findDependentById(1L)

        then:
        result.isEmpty()
    }

    // --- addDependent ---

    def "should add dependent"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def dto = new MemberDTO()
        dto.firstName = "Child"
        dto.lastName = "Doe"
        dto.phoneNumber = "+19999999999"

        when:
        def result = service.addDependent(1L, dto)

        then:
        result.firstName == "Child"
        result.role == Member.Role.dependent
        result.familyHead == testMember
    }

    def "should throw when adding dependent to non-existent head"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.addDependent(999L, new MemberDTO())

        then:
        thrown(RuntimeException)
    }

    def "should generate phone for dependent without phone"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def dto = new MemberDTO()
        dto.firstName = "Child"
        dto.lastName = "Doe"
        // No phone number provided

        when:
        def result = service.addDependent(1L, dto)

        then:
        result.phoneNumber != null
        result.phoneNumber.startsWith("DEP-")
    }

    // --- updateDependent ---

    def "should update dependent"() {
        given:
        def dep = Member.builder().id(2L).firstName("Old").lastName("Name").role(Member.Role.dependent).build()
        memberRepository.findById(2L) >> Optional.of(dep)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def dto = new MemberDTO()
        dto.firstName = "New"
        dto.lastName = "Name"

        when:
        def result = service.updateDependent(2L, dto)

        then:
        result.firstName == "New"
    }

    def "should throw when updating non-dependent member"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember) // role=member

        when:
        service.updateDependent(1L, new MemberDTO())

        then:
        thrown(RuntimeException)
    }

    // --- deleteDependent ---

    def "should delete dependent"() {
        given:
        def dep = Member.builder().id(2L).role(Member.Role.dependent).build()
        memberRepository.findById(2L) >> Optional.of(dep)

        when:
        service.deleteDependent(2L)

        then:
        1 * memberRepository.delete(dep)
    }

    def "should throw when deleting non-dependent"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)

        when:
        service.deleteDependent(1L)

        then:
        thrown(RuntimeException)
    }

    // --- countDependents ---

    def "should count dependents"() {
        given:
        dependentRepository.count() >> 5L

        when:
        def result = service.countDependents()

        then:
        result == 5L
    }

    // --- update ---

    def "should update member basic fields"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.firstName = "Updated"
        request.lastName = "Name"
        request.email = "updated@test.com"

        when:
        def result = service.update(1L, request)

        then:
        result.firstName == "Updated"
        result.email == "updated@test.com"
    }

    def "should update member with roles"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.roles = ["admin", "treasurer"]

        when:
        def result = service.update(1L, request)

        then:
        result.roles.contains('"admin"')
        result.role == Member.Role.admin
    }

    def "should update member with gender and marital status"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.gender = "male"
        request.maritalStatus = "married"

        when:
        def result = service.update(1L, request)

        then:
        result.gender == Member.Gender.male
        result.maritalStatus == Member.MaritalStatus.married
    }

    def "should ignore invalid gender value"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.gender = "INVALID"

        when:
        def result = service.update(1L, request)

        then:
        noExceptionThrown()
    }

    def "should throw when updating non-existent member"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.update(999L, new MemberUpdateRequest())

        then:
        thrown(RuntimeException)
    }

    // --- delete ---

    def "should delete member"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)

        when:
        service.delete(1L)

        then:
        1 * memberRepository.delete(testMember)
    }

    def "should throw when deleting non-existent member"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.delete(999L)

        then:
        thrown(RuntimeException)
    }

    // --- findPendingWelcomes ---

    def "should find pending welcomes"() {
        given:
        def pageable = PageRequest.of(0, 10)
        def unwelcomed = Member.builder().id(3L).firstName("New").lastName("Person").isActive(true).build()
        memberRepository.findByIsWelcomedFalseAndIsActiveTrue(pageable) >> new PageImpl<>([unwelcomed])

        when:
        def result = service.findPendingWelcomes(pageable)

        then:
        result.totalElements == 1
    }

    // --- updateMemberRole ---

    def "should update member role with multiple roles"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        when:
        def result = service.updateMemberRole(1L, null, ["admin", "treasurer"])

        then:
        result.roles.contains('"admin"')
        result.roles.contains('"treasurer"')
        result.roles.contains('"member"') // always included
    }

    def "should update member role with single role"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        when:
        def result = service.updateMemberRole(1L, "admin", null)

        then:
        result.role == Member.Role.admin
    }

    def "should filter invalid roles"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        when:
        def result = service.updateMemberRole(1L, null, ["admin", "fake_role"])

        then:
        // Should have admin + member (fake_role filtered out)
        result.roles.contains('"admin"')
        result.roles.contains('"member"')
    }

    def "should throw when updating role of non-existent member"() {
        given:
        memberRepository.findById(999L) >> Optional.empty()

        when:
        service.updateMemberRole(999L, "admin", null)

        then:
        thrown(RuntimeException)
    }

    // --- markWelcomed ---

    def "should mark member as welcomed"() {
        given:
        def unwelcomed = Member.builder().id(3L).firstName("New").lastName("Person").isWelcomed(false).build()
        def welcomer = Member.builder().id(2L).firstName("Admin").build()
        memberRepository.findById(3L) >> Optional.of(unwelcomed)
        memberRepository.findById(2L) >> Optional.of(welcomer)
        memberRepository.save(_ as Member) >> { Member m -> m }

        when:
        def result = service.markWelcomed(3L, 2L)

        then:
        result.isWelcomed()
        result.welcomedBy == welcomer
    }

    def "should return already welcomed member without changes"() {
        given:
        def alreadyWelcomed = Member.builder().id(3L).isWelcomed(true).build()
        memberRepository.findById(3L) >> Optional.of(alreadyWelcomed)

        when:
        def result = service.markWelcomed(3L, 2L)

        then:
        result.isWelcomed()
        0 * memberRepository.save(_)
    }

    def "should mark welcomed with null welcomedBy"() {
        given:
        def unwelcomed = Member.builder().id(3L).isWelcomed(false).build()
        memberRepository.findById(3L) >> Optional.of(unwelcomed)
        memberRepository.save(_ as Member) >> { Member m -> m }

        when:
        def result = service.markWelcomed(3L, null)

        then:
        result.isWelcomed()
    }

    // --- promoteDependent ---

    def "should promote dependent to member"() {
        given:
        def parent = Member.builder().id(1L).firstName("Parent").lastName("Doe")
                .phoneNumber("+11111111111").streetLine1("123 Main")
                .city("Anytown").state("CA").postalCode("12345").build()

        def dep = Dependent.builder()
                .id(10L).firstName("Child").lastName("Doe")
                .phone("+19999999999").member(parent)
                .build()

        dependentRepository.findById(10L) >> Optional.of(dep)
        memberRepository.findByPhoneNumber("+19999999999") >> Optional.empty()
        memberRepository.save(_ as Member) >> { Member m ->
            m.id = 100L
            return m
        }
        dependentRepository.save(_ as Dependent) >> { Dependent d -> d }

        when:
        def result = service.promoteDependent(10L, null, null)

        then:
        result.id == 100L
        result.firstName == "Child"
        result.role == Member.Role.member
    }

    def "should throw when dependent not found"() {
        given:
        dependentRepository.findById(999L) >> Optional.empty()

        when:
        service.promoteDependent(999L, null, null)

        then:
        thrown(RuntimeException)
    }

    def "should throw when dependent has no phone"() {
        given:
        def dep = Dependent.builder()
                .id(10L).firstName("Child").member(testMember)
                .build() // no phone

        dependentRepository.findById(10L) >> Optional.of(dep)

        when:
        service.promoteDependent(10L, null, null)

        then:
        thrown(RuntimeException)
    }

    def "should throw when phone already exists"() {
        given:
        def dep = Dependent.builder()
                .id(10L).firstName("Child").member(testMember)
                .phone("+11234567890").build()

        dependentRepository.findById(10L) >> Optional.of(dep)
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember)

        when:
        service.promoteDependent(10L, null, null)

        then:
        thrown(RuntimeException)
    }

    def "should throw when dependent already promoted"() {
        given:
        def otherMember = Member.builder().id(99L).build()
        def dep = Dependent.builder()
                .id(10L).firstName("Child").member(testMember)
                .linkedMember(otherMember).phone("+19999999999")
                .build()

        dependentRepository.findById(10L) >> Optional.of(dep)

        when:
        service.promoteDependent(10L, null, null)

        then:
        thrown(RuntimeException)
    }

    // --- validateHeadOfHousehold ---

    def "should validate head of household"() {
        given:
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember) // familyHead is null = head

        when:
        def result = service.validateHeadOfHousehold("11234567890")

        then:
        result["memberId"] == 1L
        result["firstName"] == "John"
    }

    def "should throw when phone not found"() {
        given:
        memberRepository.findByPhoneNumber("+19999") >> Optional.empty()

        when:
        service.validateHeadOfHousehold("9999")

        then:
        thrown(RuntimeException)
    }

    def "should throw when member is not head of household"() {
        given:
        def dep = Member.builder().id(2L).firstName("Dep").lastName("Member")
                .phoneNumber("+12222222222")
                .familyHead(testMember) // has a different family head
                .build()
        memberRepository.findByPhoneNumber("+12222222222") >> Optional.of(dep)

        when:
        service.validateHeadOfHousehold("2222222222")

        then:
        thrown(RuntimeException)
    }

    // --- checkRegistrationStatus ---

    def "should check registration status - complete"() {
        given:
        memberRepository.findByEmail("john@test.com") >> Optional.of(testMember)

        when:
        def result = service.checkRegistrationStatus("john@test.com", null)

        then:
        result["status"] == "complete"
        result.containsKey("member")
    }

    def "should check registration status by firebase uid"() {
        given:
        testMember.firebaseUid = "uid123"
        memberRepository.findByEmail(_) >> Optional.empty()
        memberRepository.findByFirebaseUid("uid123") >> Optional.of(testMember)

        when:
        def result = service.checkRegistrationStatus("nonexistent@test.com", "uid123")

        then:
        result["status"] == "complete"
        result["hasFirebaseUid"] == true
    }

    def "should check registration status - incomplete"() {
        given:
        memberRepository.findByEmail(_) >> Optional.empty()
        memberRepository.findByFirebaseUid(_) >> Optional.empty()

        when:
        def result = service.checkRegistrationStatus("unknown@test.com", "uid999")

        then:
        result["status"] == "incomplete"
    }

    // --- update comprehensive coverage ---

    def "should update member address fields"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.streetLine1 = "123 Main St"
        request.apartmentNo = "4B"
        request.city = "Springfield"
        request.state = "IL"
        request.postalCode = "62704"
        request.country = "US"

        when:
        def result = service.update(1L, request)

        then:
        result.streetLine1 == "123 Main St"
        result.city == "Springfield"
        result.state == "IL"
        result.postalCode == "62704"
        result.country == "US"
    }

    def "should update member emergency contact"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.emergencyContactName = "Jane Doe"
        request.emergencyContactPhone = "+11111111111"

        when:
        def result = service.update(1L, request)

        then:
        result.emergencyContactName == "Jane Doe"
        result.emergencyContactPhone == "+11111111111"
    }

    def "should update member status flags"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.isActive = false
        request.isWelcomed = true
        request.role = "admin"

        when:
        def result = service.update(1L, request)

        then:
        !result.isActive()
        result.isWelcomed()
        result.role == Member.Role.admin
    }

    def "should update member spiritual info"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.baptismName = "Michael"
        request.repentanceFather = "Father Abraham"
        request.spouseName = "Mary"
        request.dateJoinedParish = "2020-06-15"
        request.interestedInServing = "yes"
        request.isBaptized = true

        when:
        def result = service.update(1L, request)

        then:
        result.baptismName == "Michael"
        result.repentanceFather == "Father Abraham"
        result.spouseName == "Mary"
        result.interestedInServing == Member.InterestedInServing.yes
        result.isBaptized == true
    }

    def "should update member medical info"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.medicalConditions = "None"
        request.allergies = "Peanuts"
        request.medications = "None"
        request.dietaryRestrictions = "Gluten free"

        when:
        def result = service.update(1L, request)

        then:
        result.medicalConditions == "None"
        result.allergies == "Peanuts"
        result.dietaryRestrictions == "Gluten free"
    }

    def "should update member household and notes"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.householdSize = 4
        request.notes = "Special notes"
        request.phoneNumber = "+19876543210"
        request.dateOfBirth = LocalDate.of(1990, 5, 15)
        request.middleName = "Michael"

        when:
        def result = service.update(1L, request)

        then:
        result.householdSize == 4
        result.notes == "Special notes"
        result.phoneNumber == "+19876543210"
    }

    def "should ignore invalid marital status"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.maritalStatus = "INVALID_STATUS"

        when:
        def result = service.update(1L, request)

        then:
        noExceptionThrown()
    }

    def "should ignore invalid interestedInServing value"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.interestedInServing = "INVALID"

        when:
        def result = service.update(1L, request)

        then:
        noExceptionThrown()
    }

    def "should ignore invalid role value in update"() {
        given:
        memberRepository.findById(1L) >> Optional.of(testMember)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def request = new MemberUpdateRequest()
        request.role = "NONEXISTENT_ROLE"

        when:
        def result = service.update(1L, request)

        then:
        noExceptionThrown()
    }

    // --- addDependent with full fields ---

    def "should add dependent with all fields"() {
        given:
        def head = Member.builder().id(1L).firstName("John").lastName("Doe")
                .streetLine1("123 Main").city("Town").state("CA").postalCode("90210").country("US")
                .build()
        memberRepository.findById(1L) >> Optional.of(head)
        memberRepository.save(_ as Member) >> { Member m -> m }

        def dto = new MemberDTO()
        dto.firstName = "Child"
        dto.lastName = "Doe"
        dto.middleName = "Middle"
        dto.dateOfBirth = "2010-05-15"
        dto.gender = "male"
        dto.email = "child@test.com"
        dto.phoneNumber = "+19999999999"
        dto.baptismName = "Gabriel"
        dto.isBaptized = true
        dto.medicalConditions = "None"
        dto.allergies = "None"
        dto.medications = "None"
        dto.dietaryRestrictions = "None"
        dto.notes = "Good kid"

        when:
        def result = service.addDependent(1L, dto)

        then:
        result.middleName == "Middle"
        result.email == "child@test.com"
        result.baptismName == "Gabriel"
        result.isBaptized == true
        result.streetLine1 == "123 Main"
        result.city == "Town"
    }

    // --- promoteDependent with email and gender ---

    def "should promote dependent with provided email and phone"() {
        given:
        def parent = Member.builder().id(1L).firstName("Parent").lastName("Doe")
                .phoneNumber("+11111111111").streetLine1("123 Main")
                .city("Anytown").state("CA").postalCode("12345").build()

        def dep = Dependent.builder()
                .id(10L).firstName("Child").middleName("M").lastName("Doe")
                .phone("+10000000000").email("old@test.com")
                .gender("female").dateOfBirth(LocalDate.of(2000, 1, 1))
                .baptismName("Mary")
                .member(parent)
                .build()

        dependentRepository.findById(10L) >> Optional.of(dep)
        memberRepository.findByPhoneNumber("+15555555555") >> Optional.empty()
        memberRepository.save(_ as Member) >> { Member m ->
            m.id = 101L
            return m
        }
        dependentRepository.save(_ as Dependent) >> { Dependent d -> d }

        when:
        def result = service.promoteDependent(10L, "new@test.com", "+15555555555")

        then:
        result.id == 101L
        result.email == "new@test.com"
        result.phoneNumber == "+15555555555"
        result.gender == Member.Gender.female
    }

    def "should promote dependent using dependent email when no email provided"() {
        given:
        def parent = Member.builder().id(1L).firstName("Parent").lastName("Doe")
                .phoneNumber("+11111111111").build()

        def dep = Dependent.builder()
                .id(10L).firstName("Child").lastName("Doe")
                .phone("+18888888888").email("dep@test.com")
                .member(parent)
                .build()

        dependentRepository.findById(10L) >> Optional.of(dep)
        memberRepository.findByPhoneNumber("+18888888888") >> Optional.empty()
        memberRepository.save(_ as Member) >> { Member m ->
            m.id = 102L
            return m
        }
        dependentRepository.save(_ as Dependent) >> { Dependent d -> d }

        when:
        def result = service.promoteDependent(10L, null, null)

        then:
        result.email == "dep@test.com"
    }

    def "should promote dependent with parent having family head"() {
        given:
        def grandparent = Member.builder().id(5L).firstName("Grand").lastName("Parent").build()
        def parent = Member.builder().id(1L).firstName("Parent").lastName("Doe")
                .phoneNumber("+11111111111").familyHead(grandparent).build()

        def dep = Dependent.builder()
                .id(10L).firstName("Child").lastName("Doe")
                .phone("+17777777777")
                .member(parent)
                .build()

        dependentRepository.findById(10L) >> Optional.of(dep)
        memberRepository.findByPhoneNumber("+17777777777") >> Optional.empty()
        memberRepository.save(_ as Member) >> { Member m ->
            m.id = 103L
            return m
        }
        dependentRepository.save(_ as Dependent) >> { Dependent d -> d }

        when:
        def result = service.promoteDependent(10L, null, null)

        then:
        result.familyHead == grandparent
    }

    // --- validate head of household with plus prefix ---

    def "should validate head of household with plus prefix"() {
        given:
        memberRepository.findByPhoneNumber("+11234567890") >> Optional.of(testMember)

        when:
        def result = service.validateHeadOfHousehold("+11234567890")

        then:
        result["memberId"] == 1L
    }

    def "should validate self-referencing family head"() {
        given:
        def selfHead = Member.builder().id(5L).firstName("Self").lastName("Head")
                .phoneNumber("+15555555555").build()
        selfHead.familyHead = selfHead // references self

        memberRepository.findByPhoneNumber("+15555555555") >> Optional.of(selfHead)

        when:
        def result = service.validateHeadOfHousehold("15555555555")

        then:
        result["memberId"] == 5L
    }

    // --- checkRegistrationStatus edge cases ---

    def "should check registration status with null email using firebase uid"() {
        given:
        testMember.firebaseUid = "uid456"
        memberRepository.findByFirebaseUid("uid456") >> Optional.of(testMember)

        when:
        def result = service.checkRegistrationStatus(null, "uid456")

        then:
        result["status"] == "complete"
    }

    def "should check registration status with no firebase uid"() {
        given:
        memberRepository.findByEmail("found@test.com") >> Optional.of(testMember)

        when:
        def result = service.checkRegistrationStatus("found@test.com", null)

        then:
        result["status"] == "complete"
        result["hasFirebaseUid"] == false
    }
}
