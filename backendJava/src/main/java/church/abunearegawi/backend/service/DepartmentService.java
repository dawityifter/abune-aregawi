package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.DepartmentDTO;
import church.abunearegawi.backend.model.Department;
import church.abunearegawi.backend.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final church.abunearegawi.backend.repository.DepartmentMeetingRepository meetingRepository;
    private final church.abunearegawi.backend.repository.DepartmentTaskRepository taskRepository;

    @Transactional(readOnly = true)
    public DepartmentDTO findById(Long id) {
        return departmentRepository.findById(id)
                .map(this::toDTO)
                .orElseThrow(() -> new RuntimeException("Department not found: " + id));
    }

    @Transactional(readOnly = true)
    public Page<DepartmentDTO> findAll(Pageable pageable) {
        return departmentRepository.findAll(pageable)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public List<DepartmentDTO> findByActive(boolean isActive) {
        return departmentRepository.findByActive(isActive)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<DepartmentDTO> findByName(String name) {
        return departmentRepository.findByName(name)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public List<DepartmentDTO> findSubDepartments(Long parentId) {
        return departmentRepository.findByParentDepartmentId(parentId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DepartmentDTO> getDepartmentsByMember(Long memberId) {
        return departmentRepository.findDepartmentsByMemberId(memberId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public church.abunearegawi.backend.dto.DepartmentMeetingDTO getMeeting(Long id) {
        return meetingRepository.findById(id)
                .map(this::toMeetingDTO)
                .orElseThrow(() -> new RuntimeException("Meeting not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<church.abunearegawi.backend.dto.DepartmentMeetingDTO> getMeetings(Long departmentId) {
        return meetingRepository.findByDepartmentId(departmentId)
                .stream()
                .map(this::toMeetingDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<church.abunearegawi.backend.dto.DepartmentTaskDTO> getTasks(Long departmentId) {
        return taskRepository.findByDepartmentId(departmentId)
                .stream()
                .map(this::toTaskDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public DepartmentDTO create(Department department) {
        Department saved = departmentRepository.save(department);
        return toDTO(saved);
    }

    @Transactional
    public DepartmentDTO update(Long id, Department department) {
        Department existing = departmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Department not found: " + id));

        // Update fields
        existing.setName(department.getName());
        existing.setDescription(department.getDescription());
        existing.setType(department.getType());
        existing.setLeader(department.getLeader()); // Ensure relationship is handled correctly
        existing.setContactEmail(department.getContactEmail());
        existing.setContactPhone(department.getContactPhone());
        existing.setMeetingSchedule(department.getMeetingSchedule());
        existing.setActive(department.isActive());
        existing.setPublic(department.isPublic());
        existing.setMaxMembers(department.getMaxMembers());
        existing.setSortOrder(department.getSortOrder());

        Department updated = departmentRepository.save(existing);
        return toDTO(updated);
    }

    @Transactional
    public church.abunearegawi.backend.dto.DepartmentMeetingDTO updateMeeting(Long id,
            church.abunearegawi.backend.model.DepartmentMeeting details) {
        church.abunearegawi.backend.model.DepartmentMeeting existing = meetingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Meeting not found: " + id));

        if (details.getTitle() != null)
            existing.setTitle(details.getTitle());
        if (details.getMeetingDate() != null)
            existing.setMeetingDate(details.getMeetingDate());
        if (details.getLocation() != null)
            existing.setLocation(details.getLocation());
        if (details.getPurpose() != null)
            existing.setPurpose(details.getPurpose());
        if (details.getAgenda() != null)
            existing.setAgenda(details.getAgenda());
        if (details.getAttendees() != null)
            existing.setAttendees(details.getAttendees());
        if (details.getMinutes() != null)
            existing.setMinutes(details.getMinutes());

        church.abunearegawi.backend.model.DepartmentMeeting saved = meetingRepository.save(existing);
        return toMeetingDTO(saved);
    }

    @Transactional
    public void delete(Long id) {
        departmentRepository.deleteById(id);
    }

    private DepartmentDTO toDTO(Department d) {
        return new DepartmentDTO(
                d.getId(),
                d.getName(),
                d.getDescription(),
                d.getType(),
                d.getParentDepartment() != null ? d.getParentDepartment().getId() : null,
                d.getParentDepartment() != null ? d.getParentDepartment().getName() : null,
                d.getLeader() != null ? d.getLeader().getId() : null,
                d.getLeader() != null ? d.getLeader().getFirstName() + " " + d.getLeader().getLastName() : null,
                d.getContactEmail(),
                d.getContactPhone(),
                d.getMeetingSchedule(),
                d.isActive(),
                d.isPublic(),
                d.getMaxMembers(),
                d.getSortOrder(),
                d.getCreatedAt(),
                d.getUpdatedAt());
    }

    private church.abunearegawi.backend.dto.DepartmentMeetingDTO toMeetingDTO(
            church.abunearegawi.backend.model.DepartmentMeeting m) {
        return new church.abunearegawi.backend.dto.DepartmentMeetingDTO(
                m.getId(),
                m.getDepartment().getId(),
                m.getTitle(),
                m.getMeetingDate(),
                m.getLocation(),
                m.getPurpose(),
                m.getAgenda(),
                m.getMinutes(),
                m.getAttendees(),
                m.getCreator() != null ? m.getCreator().getId() : null,
                m.getCreatedAt(),
                m.getUpdatedAt());
    }

    private church.abunearegawi.backend.dto.DepartmentTaskDTO toTaskDTO(
            church.abunearegawi.backend.model.DepartmentTask t) {
        return new church.abunearegawi.backend.dto.DepartmentTaskDTO(
                t.getId(),
                t.getDepartment().getId(),
                t.getMeeting() != null ? t.getMeeting().getId() : null,
                t.getTitle(),
                t.getDescription(),
                t.getAssignee() != null ? t.getAssignee().getId() : null,
                t.getAssignee() != null ? t.getAssignee().getFirstName() + " " + t.getAssignee().getLastName() : null,
                t.getStatus() != null ? t.getStatus().name() : null,
                t.getPriority() != null ? t.getPriority().name() : null,
                t.getDueDate(),
                t.getStartDate(),
                t.getEndDate(),
                t.getRejectedDate(),
                t.getNotes(),
                t.getCreator() != null ? t.getCreator().getId() : null,
                t.getCreatedAt(),
                t.getUpdatedAt());
    }
}
