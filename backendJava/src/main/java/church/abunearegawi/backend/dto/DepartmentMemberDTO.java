package church.abunearegawi.backend.dto;

import java.time.LocalDateTime;

public record DepartmentMemberDTO(
                Long id,
                Long departmentId,
                String departmentName,
                Long memberId,
                String memberName,
                String memberFirstName,
                String memberLastName,
                String memberEmail,
                String memberPhone,
                String roleInDepartment,
                String status,
                LocalDateTime joinedAt,
                String notes,
                LocalDateTime createdAt,
                LocalDateTime updatedAt) {
}
