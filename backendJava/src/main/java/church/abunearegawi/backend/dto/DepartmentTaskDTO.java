package church.abunearegawi.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record DepartmentTaskDTO(
        Long id,
        Long departmentId,
        Long meetingId,
        String title,
        String description,
        Long assigneeId,
        String assigneeName,
        String status,
        String priority,
        LocalDate due_date, // snake_case to match frontend
        LocalDate start_date,
        LocalDate end_date,
        LocalDate rejected_date,
        String notes,
        Long createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
