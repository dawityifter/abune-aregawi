package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.ZelleMemoMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ZelleMemoMatchRepository extends JpaRepository<ZelleMemoMatch, UUID> {
    Optional<ZelleMemoMatch> findByMemberIdAndMemo(Long memberId, String memo);

    List<ZelleMemoMatch> findByMemberId(Long memberId);

    List<ZelleMemoMatch> findByMemoContainingIgnoreCase(String memo);

    Optional<ZelleMemoMatch> findByMemoIgnoreCase(String memo);
}
