package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Voicemail;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VoicemailRepository extends JpaRepository<Voicemail, Integer> {
    Optional<Voicemail> findByRecordingUrl(String recordingUrl);
    Page<Voicemail> findByIsArchivedFalseOrderByCreatedAtDesc(Pageable pageable);
    Page<Voicemail> findByIsArchivedTrueOrderByCreatedAtDesc(Pageable pageable);
}

