package church.abunearegawi.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DepartmentMeetingDTO(
        Long id,
        Long departmentId,
        String title,
        LocalDateTime meeting_date, // snake_case to match frontend
        String location,
        String purpose,
        String agenda,
        String minutes,
        List<Object> attendees,
        Long createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
