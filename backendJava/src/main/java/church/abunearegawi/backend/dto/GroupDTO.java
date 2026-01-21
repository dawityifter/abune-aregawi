package church.abunearegawi.backend.dto;

import java.time.LocalDateTime;

public record GroupDTO(
        Long id,
        String name,
        String description,
        Long memberCount,
        String label,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
