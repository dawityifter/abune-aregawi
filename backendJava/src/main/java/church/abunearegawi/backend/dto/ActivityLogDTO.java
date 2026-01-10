package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.ActivityLog;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityLogDTO {
    private Long id;

    @JsonProperty("user_id")
    private Long userId;

    private String action;

    @JsonProperty("entity_type")
    private String entityType;

    @JsonProperty("entity_id")
    private String entityId;

    private Map<String, Object> details;

    @JsonProperty("ip_address")
    private String ipAddress;

    @JsonProperty("user_agent")
    private String userAgent;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    private ActorDTO actor;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActorDTO {
        private Long id;

        @JsonProperty("first_name")
        private String firstName;

        @JsonProperty("last_name")
        private String lastName;

        private String email;
    }

    public static ActivityLogDTO fromEntity(ActivityLog log) {
        ActorDTO actorDto = null;
        if (log.getActor() != null) {
            actorDto = ActorDTO.builder()
                    .id(log.getActor().getId())
                    .firstName(log.getActor().getFirstName())
                    .lastName(log.getActor().getLastName())
                    .email(log.getActor().getEmail())
                    .build();
        }

        return ActivityLogDTO.builder()
                .id(log.getId())
                .userId(log.getActor() != null ? log.getActor().getId() : null)
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .details(log.getDetails())
                .ipAddress(log.getIpAddress())
                .userAgent(log.getUserAgent())
                .createdAt(log.getCreatedAt())
                .actor(actorDto)
                .build();
    }
}
