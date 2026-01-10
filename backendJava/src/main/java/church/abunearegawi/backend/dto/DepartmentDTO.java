package church.abunearegawi.backend.dto;

import java.time.LocalDateTime;

/**
 * DTO for Department response
 */
public record DepartmentDTO(
        Long id,
        String name,
        String description,
        String type,
        Long parentDepartmentId,
        String parentDepartmentName,
        Long leaderId,
        String leaderName,
        String contactEmail,
        String contactPhone,
        String meetingSchedule,
        boolean isActive,
        boolean isPublic,
        Integer maxMembers,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
