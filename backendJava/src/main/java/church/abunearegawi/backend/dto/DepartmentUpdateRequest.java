package church.abunearegawi.backend.dto;

import lombok.Data;

@Data
public class DepartmentUpdateRequest {
    private String name;
    private String description;
    private String type;
    private Long leaderId;
    private String contactEmail;
    private String contactPhone;
    private String meetingSchedule;
    private Boolean isActive;
    private Boolean isPublic;
    private Integer maxMembers;
    private Integer sortOrder;
}
