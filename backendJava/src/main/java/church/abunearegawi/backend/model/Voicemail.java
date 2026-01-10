package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "voicemails")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Voicemail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "from_number", nullable = false, length = 20)
    private String fromNumber;

    @Column(name = "recording_url", nullable = false, columnDefinition = "TEXT")
    private String recordingUrl;

    @Column(name = "recording_duration")
    private Integer recordingDuration;

    @Column(name = "transcription_text", columnDefinition = "TEXT")
    private String transcriptionText;

    @Column(name = "is_archived", nullable = false)
    @Builder.Default
    private boolean isArchived = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
