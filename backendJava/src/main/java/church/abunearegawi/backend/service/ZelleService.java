package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Member;
import church.abunearegawi.backend.model.ZelleMemoMatch;
import church.abunearegawi.backend.repository.MemberRepository;
import church.abunearegawi.backend.repository.ZelleMemoMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ZelleService {

    private final ZelleMemoMatchRepository zelleMemoMatchRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findAll() {
        return zelleMemoMatchRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemberId(Long memberId) {
        return zelleMemoMatchRepository.findByMemberId(memberId);
    }

    @Transactional(readOnly = true)
    public List<ZelleMemoMatch> findByMemo(String memo) {
        return zelleMemoMatchRepository.findByMemoContainingIgnoreCase(memo);
    }

    @Transactional(readOnly = true)
    public Optional<ZelleMemoMatch> findByMemberIdAndMemo(Long memberId, String memo) {
        return zelleMemoMatchRepository.findByMemberIdAndMemo(memberId, memo);
    }

    @Transactional
    public ZelleMemoMatch create(Long memberId, String firstName, String lastName, String memo) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        ZelleMemoMatch match = ZelleMemoMatch.builder()
                .member(member)
                .firstName(firstName)
                .lastName(lastName)
                .memo(memo)
                .build();

        return zelleMemoMatchRepository.save(match);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        zelleMemoMatchRepository.deleteById(id);
    }
}

