package church.abunearegawi.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DepartmentCreateRequest {
    @NotBlank
    private String name;

    private String description;

    private String type;

    private Long parentDepartmentId;

    private Long leaderId;

    private String contactEmail;

    private String contactPhone;

    private String meetingSchedule;

    private boolean isPublic = true;

    private Integer maxMembers;

    private Integer sortOrder = 0;
}
