package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Voicemail;
import church.abunearegawi.backend.repository.VoicemailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VoicemailService {

    private final VoicemailRepository voicemailRepository;

    @Transactional(readOnly = true)
    public Page<Voicemail> findAll(boolean archived, Pageable pageable) {
        if (archived) {
            return voicemailRepository.findByIsArchivedTrueOrderByCreatedAtDesc(pageable);
        }
        return voicemailRepository.findByIsArchivedFalseOrderByCreatedAtDesc(pageable);
    }

    @Transactional(readOnly = true)
    public Optional<Voicemail> findById(Integer id) {
        return voicemailRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Voicemail> findByRecordingUrl(String recordingUrl) {
        return voicemailRepository.findByRecordingUrl(recordingUrl);
    }

    @Transactional
    public Voicemail create(Voicemail voicemail) {
        return voicemailRepository.save(voicemail);
    }

    @Transactional
    public Voicemail updateTranscription(Integer id, String transcriptionText) {
        Voicemail voicemail = voicemailRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Voicemail not found"));
        voicemail.setTranscriptionText(transcriptionText);
        return voicemailRepository.save(voicemail);
    }

    @Transactional
    public Voicemail archive(Integer id) {
        Voicemail voicemail = voicemailRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Voicemail not found"));
        voicemail.setArchived(true);
        return voicemailRepository.save(voicemail);
    }

    @Transactional
    public void delete(Integer id) {
        voicemailRepository.deleteById(id);
    }
}

