package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.DepartmentMemberDTO;
import church.abunearegawi.backend.model.Department;
import church.abunearegawi.backend.model.DepartmentMember;
import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.repository.DepartmentMemberRepository;
import church.abunearegawi.backend.repository.DepartmentRepository;
import church.abunearegawi.backend.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DepartmentMemberService {

    private final DepartmentMemberRepository departmentMemberRepository;
    private final DepartmentRepository departmentRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public List<DepartmentMemberDTO> findByDepartmentId(Long departmentId, DepartmentMember.Status status,
            String role) {
        // Verify department exists
        if (!departmentRepository.findById(departmentId).isPresent()) {
            throw new RuntimeException("Department not found");
        }

        List<DepartmentMember> members;

        if (status != null && role != null) {
            members = departmentMemberRepository.findByDepartmentIdAndStatusAndRoleInDepartment(departmentId, status,
                    role);
        } else if (status != null) {
            members = departmentMemberRepository.findByDepartmentIdAndStatus(departmentId, status);
        } else if (role != null) {
            members = departmentMemberRepository.findByDepartmentIdAndRoleInDepartment(departmentId, role);
        } else {
            members = departmentMemberRepository.findByDepartmentId(departmentId);
        }

        return members.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DepartmentMemberDTO> findByMemberId(Long memberId) {
        return departmentMemberRepository.findByMemberId(memberId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<DepartmentMemberDTO> findById(Long id) {
        return departmentMemberRepository.findById(id).map(this::toDTO);
    }

    @Transactional
    public java.util.Map<String, Object> addMembersToDepartment(Long departmentId, List<Long> memberIds,
            String roleInDepartment, String notes) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Department not found"));

        // Check max members limit
        if (department.getMaxMembers() != null) {
            long currentCount = departmentMemberRepository.countByDepartmentIdAndStatus(
                    departmentId, DepartmentMember.Status.active);
            if (currentCount + memberIds.size() > department.getMaxMembers()) {
                throw new RuntimeException("Department has reached maximum capacity of " +
                        department.getMaxMembers() + " members");
            }
        }

        List<Object> added = new ArrayList<>();
        List<Object> alreadyExists = new ArrayList<>();
        List<Long> notFound = new ArrayList<>();

        for (Long memberId : memberIds) {
            Member member = memberRepository.findById(memberId).orElse(null);
            if (member == null) {
                notFound.add(memberId);
                continue;
            }

            Optional<DepartmentMember> existing = departmentMemberRepository
                    .findByDepartmentIdAndMemberId(departmentId, memberId);
            if (existing.isPresent()) {
                alreadyExists.add(java.util.Map.of(
                        "member_id", memberId,
                        "name", member.getFirstName() + " " + member.getLastName()));
                continue;
            }

            DepartmentMember membership = DepartmentMember.builder()
                    .department(department)
                    .member(member)
                    .roleInDepartment(roleInDepartment != null ? roleInDepartment : "member")
                    .status(DepartmentMember.Status.active)
                    .notes(notes)
                    .build();

            DepartmentMember saved = departmentMemberRepository.save(membership);
            added.add(java.util.Map.of(
                    "member_id", memberId,
                    "name", member.getFirstName() + " " + member.getLastName(),
                    "role", saved.getRoleInDepartment()));
        }

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("added", added);
        result.put("already_exists", alreadyExists);
        result.put("not_found", notFound);

        return result;
    }

    @Transactional
    public DepartmentMemberDTO update(Long id, DepartmentMember.Status status, String roleInDepartment, String notes) {
        DepartmentMember membership = departmentMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Department membership not found"));

        if (status != null)
            membership.setStatus(status);
        if (roleInDepartment != null)
            membership.setRoleInDepartment(roleInDepartment);
        if (notes != null)
            membership.setNotes(notes);

        DepartmentMember saved = departmentMemberRepository.save(membership);
        return toDTO(saved);
    }

    @Transactional
    public void removeFromDepartment(Long id) {
        departmentMemberRepository.deleteById(id);
    }

    private DepartmentMemberDTO toDTO(DepartmentMember dm) {
        return new DepartmentMemberDTO(
                dm.getId(),
                dm.getDepartment().getId(),
                dm.getDepartment().getName(),
                dm.getMember().getId(),
                dm.getMember().getFirstName() + " " + dm.getMember().getLastName(),
                dm.getMember().getFirstName(),
                dm.getMember().getLastName(),
                dm.getMember().getEmail(),
                dm.getMember().getPhoneNumber(),
                dm.getRoleInDepartment(),
                dm.getStatus() != null ? dm.getStatus().name() : null,
                dm.getJoinedAt(),
                dm.getNotes(),
                dm.getCreatedAt(),
                dm.getUpdatedAt());
    }
}
