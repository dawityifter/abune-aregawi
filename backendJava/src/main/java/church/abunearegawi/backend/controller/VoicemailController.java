package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.Voicemail;
import church.abunearegawi.backend.service.VoicemailService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/twilio/admin/voicemails")
@RequiredArgsConstructor
public class VoicemailController {

    private final VoicemailService voicemailService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getVoicemails(
            @RequestParam(name = "archived", defaultValue = "false") boolean archived,
            Pageable pageable) {
        Page<Voicemail> page = voicemailService.findAll(archived, pageable);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("voicemails", page.getContent());

        Map<String, Object> pagination = new HashMap<>();
        pagination.put("total", page.getTotalElements());
        pagination.put("pages", page.getTotalPages());
        pagination.put("page", page.getNumber() + 1);
        responseData.put("pagination", pagination);

        return ResponseEntity.ok(ApiResponse.success(responseData));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<Voicemail>> getVoicemailById(@PathVariable Integer id) {
        return voicemailService.findById(id)
                .map(voicemail -> ResponseEntity.ok(ApiResponse.success(voicemail)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/stream")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<org.springframework.core.io.Resource> streamVoicemail(@PathVariable Integer id) {
        // For now, if local or direct URL, we can redirect or pipe.
        // But since the frontend uses Audio tag with src=backend_url, a redirect is
        // easiest if the URL is accessible.
        // If it sends headers (which SecureAudioPlayer does), redirect might lose them?
        // Actually SecureAudioPlayer fetches blob using fetch() then creates objectURL.
        // So a redirect 302 should work fine for fetch() to follow.

        return voicemailService.findById(id)
                .map(vm -> ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                        .location(URI.create(vm.getRecordingUrl())).<org.springframework.core.io.Resource>build())
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Voicemail>> createVoicemail(@RequestBody Map<String, Object> request) {
        Voicemail voicemail = Voicemail.builder()
                .fromNumber(request.get("fromNumber") != null ? request.get("fromNumber").toString() : "Unknown")
                .recordingUrl(request.get("recordingUrl") != null ? request.get("recordingUrl").toString() : "")
                .recordingDuration(request.get("recordingDuration") != null
                        ? Integer.parseInt(request.get("recordingDuration").toString())
                        : null)
                .transcriptionText(
                        request.get("transcriptionText") != null ? request.get("transcriptionText").toString() : null)
                .build();

        Voicemail created = voicemailService.create(voicemail);
        return ResponseEntity.created(URI.create("/api/twilio/admin/voicemails/" + created.getId()))
                .body(ApiResponse.success(created));
    }

    @PutMapping("/{id}/transcription")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Voicemail>> updateTranscription(
            @PathVariable Integer id,
            @RequestBody Map<String, String> request) {
        String transcriptionText = request.get("transcriptionText");
        Voicemail updated = voicemailService.updateTranscription(id, transcriptionText);
        return ResponseEntity.ok(ApiResponse.success(updated, "Transcription updated successfully"));
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Voicemail>> archiveVoicemail(@PathVariable Integer id) {
        Voicemail archived = voicemailService.archive(id);
        return ResponseEntity.ok(ApiResponse.success(archived, "Voicemail archived successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteVoicemail(@PathVariable Integer id) {
        voicemailService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Voicemail deleted successfully"));
    }
}
