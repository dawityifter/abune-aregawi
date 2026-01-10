package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Pledge;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.PledgeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PledgeService {

    private final PledgeRepository pledgeRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Page<Pledge> findAll(Pledge.Status status, Pledge.PledgeType pledgeType,
                               String eventName, Long memberId, Pageable pageable) {
        return pledgeRepository.findWithFilters(status, pledgeType, eventName, memberId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<Pledge> findByMemberId(Long memberId, Pageable pageable) {
        return pledgeRepository.findByMemberId(memberId, pageable);
    }

    @Transactional(readOnly = true)
    public Optional<Pledge> findById(Long id) {
        return pledgeRepository.findById(id);
    }

    @Transactional
    public Pledge create(Pledge pledge, String email, String phone) {
        // Validate amount
        if (pledge.getAmount() == null || pledge.getAmount().compareTo(BigDecimal.ONE) < 0) {
            throw new RuntimeException("Amount must be at least $1.00");
        }

        // Try to find existing member by email or phone
        Member linkedMember = null;
        if (email != null && !email.trim().isEmpty()) {
            linkedMember = memberRepository.findByEmail(email).orElse(null);
        }
        if (linkedMember == null && phone != null && !phone.trim().isEmpty()) {
            String normalizedPhone = phone.startsWith("+") ? phone : "+" + phone;
            linkedMember = memberRepository.findByPhoneNumber(normalizedPhone).orElse(null);
        }

        if (linkedMember != null) {
            pledge.setMember(linkedMember);
        }

        // Set default values if not provided
        if (pledge.getStatus() == null) {
            pledge.setStatus(Pledge.Status.pending);
        }
        if (pledge.getPledgeDate() == null) {
            pledge.setPledgeDate(java.time.LocalDateTime.now());
        }
        if (pledge.getCurrency() == null || pledge.getCurrency().trim().isEmpty()) {
            pledge.setCurrency("usd");
        }
        if (pledge.getPledgeType() == null) {
            pledge.setPledgeType(Pledge.PledgeType.general);
        }

        return pledgeRepository.save(pledge);
    }

    @Transactional
    public Pledge update(Long id, Pledge pledge) {
        Pledge existing = pledgeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pledge not found"));

        if (pledge.getAmount() != null) existing.setAmount(pledge.getAmount());
        if (pledge.getStatus() != null) existing.setStatus(pledge.getStatus());
        if (pledge.getPledgeType() != null) existing.setPledgeType(pledge.getPledgeType());
        if (pledge.getEventName() != null) existing.setEventName(pledge.getEventName());
        if (pledge.getDueDate() != null) existing.setDueDate(pledge.getDueDate());
        if (pledge.getFulfilledDate() != null) existing.setFulfilledDate(pledge.getFulfilledDate());
        if (pledge.getNotes() != null) existing.setNotes(pledge.getNotes());
        if (pledge.getMetadata() != null) existing.setMetadata(pledge.getMetadata());

        return pledgeRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        pledgeRepository.deleteById(id);
    }
}

