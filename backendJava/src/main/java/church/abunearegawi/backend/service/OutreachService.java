package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.Outreach;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.OutreachRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OutreachService {

    private final OutreachRepository outreachRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public List<Outreach> findByMemberId(Long memberId) {
        return outreachRepository.findByMemberIdOrderByWelcomedDateDescCreatedAtDesc(memberId);
    }

    @Transactional
    public Outreach create(Long memberId, String note, String welcomedBy) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        Outreach outreach = Outreach.builder()
                .member(member)
                .welcomedBy(welcomedBy != null ? welcomedBy : "unknown")
                .welcomedDate(java.time.LocalDateTime.now())
                .note(note != null ? note.trim() : "")
                .build();

        return outreachRepository.save(outreach);
    }
}
