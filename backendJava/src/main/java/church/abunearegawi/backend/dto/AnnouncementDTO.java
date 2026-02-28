package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.Announcement;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Builder
public class AnnouncementDTO {
    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private Long createdByMemberId;
    private LocalDateTime createdAt;

    public static AnnouncementDTO from(Announcement a) {
        return AnnouncementDTO.builder()
            .id(a.getId()).title(a.getTitle()).description(a.getDescription())
            .startDate(a.getStartDate()).endDate(a.getEndDate())
            .status(a.getStatus().name().toLowerCase())
            .createdByMemberId(a.getCreatedByMemberId()).createdAt(a.getCreatedAt())
            .build();
    }
}
