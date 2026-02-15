package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.VolunteerRequest;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.VolunteerRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VolunteerService {

    private final VolunteerRequestRepository volunteerRequestRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Page<VolunteerRequest> findAll(VolunteerRequest.Status status, Pageable pageable) {
        if (status != null) {
            return volunteerRequestRepository.findByStatus(status, pageable);
        }
        return volunteerRequestRepository.findAll(pageable);
    }

    /**
     * Return volunteer requests as a Map matching the Node.js response format:
     * { requests: [...], pagination: { page, limit, total, pages } }
     * Accesses member within transaction to avoid LazyInitializationException.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> findAllAsMap(VolunteerRequest.Status status, Pageable pageable) {
        Page<VolunteerRequest> page = findAll(status, pageable);

        List<Map<String, Object>> requests = page.getContent().stream()
                .map(this::toMap)
                .toList();

        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", page.getNumber() + 1);
        pagination.put("limit", page.getSize());
        pagination.put("total", page.getTotalElements());
        pagination.put("pages", page.getTotalPages());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requests", requests);
        result.put("pagination", pagination);
        return result;
    }

    private Map<String, Object> toMap(VolunteerRequest vr) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", vr.getId());
        map.put("member_id", vr.getMember() != null ? vr.getMember().getId() : null);
        map.put("message", vr.getMessage());
        map.put("agreed_to_contact", vr.isAgreedToContact());
        map.put("status", vr.getStatus() != null ? vr.getStatus().name().toLowerCase() : null);
        map.put("created_at", vr.getCreatedAt());
        map.put("updated_at", vr.getUpdatedAt());

        if (vr.getMember() != null) {
            Member m = vr.getMember();
            Map<String, Object> member = new LinkedHashMap<>();
            member.put("first_name", m.getFirstName());
            member.put("last_name", m.getLastName());
            member.put("phone_number", m.getPhoneNumber());
            member.put("email", m.getEmail());
            map.put("member", member);
        }
        return map;
    }

    @Transactional(readOnly = true)
    public Page<VolunteerRequest> findByMemberId(Long memberId, Pageable pageable) {
        return volunteerRequestRepository.findByMemberId(memberId, pageable);
    }

    @Transactional(readOnly = true)
    public Optional<VolunteerRequest> findById(Integer id) {
        return volunteerRequestRepository.findById(id);
    }

    @Transactional
    public VolunteerRequest create(Long memberId, String message, boolean agreedToContact) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        VolunteerRequest request = VolunteerRequest.builder()
                .member(member)
                .message(message)
                .agreedToContact(agreedToContact)
                .status(VolunteerRequest.Status.NEW)
                .build();

        return volunteerRequestRepository.save(request);
    }

    @Transactional
    public VolunteerRequest updateStatus(Integer id, VolunteerRequest.Status status) {
        VolunteerRequest request = volunteerRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Volunteer request not found"));

        request.setStatus(status);
        return volunteerRequestRepository.save(request);
    }

    @Transactional
    public void delete(Integer id) {
        volunteerRequestRepository.deleteById(id);
    }
}
