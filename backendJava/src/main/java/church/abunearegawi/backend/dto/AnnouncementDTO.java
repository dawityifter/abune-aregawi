package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.Announcement;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Builder
public class AnnouncementDTO {
    private Long id;
    private String title;
    private String description;

    @JsonProperty("title_ti")
    private String titleTi;

    @JsonProperty("description_ti")
    private String descriptionTi;

    @JsonProperty("start_date")
    private LocalDate startDate;

    @JsonProperty("end_date")
    private LocalDate endDate;

    private String status;

    @JsonProperty("created_by_member_id")
    private Long createdByMemberId;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    public static AnnouncementDTO from(Announcement a) {
        return AnnouncementDTO.builder()
            .id(a.getId()).title(a.getTitle()).description(a.getDescription())
            .titleTi(a.getTitleTi()).descriptionTi(a.getDescriptionTi())
            .startDate(a.getStartDate()).endDate(a.getEndDate())
            .status(a.getStatus().name().toLowerCase())
            .createdByMemberId(a.getCreatedByMemberId()).createdAt(a.getCreatedAt())
            .build();
    }
}
