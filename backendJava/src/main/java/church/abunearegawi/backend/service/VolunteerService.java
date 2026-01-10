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

