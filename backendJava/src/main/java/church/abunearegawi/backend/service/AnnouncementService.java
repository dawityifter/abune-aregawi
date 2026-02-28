package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.AnnouncementDTO;
import church.abunearegawi.backend.model.Announcement;
import church.abunearegawi.backend.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;

    public List<AnnouncementDTO> list(String status) {
        LocalDate today = LocalDate.now();
        List<Announcement> results = switch (status == null ? "all" : status) {
            case "active" -> announcementRepository.findActiveTodayOrderByStartDateDesc(today);
            case "cancelled" -> announcementRepository.findByStatusOrderByStartDateDesc(Announcement.Status.CANCELLED);
            case "expired" -> announcementRepository.findExpiredOrderByStartDateDesc(today);
            default -> announcementRepository.findAllByOrderByStartDateDesc();
        };
        return results.stream().map(AnnouncementDTO::from).collect(Collectors.toList());
    }

    public List<AnnouncementDTO> getActive() {
        return announcementRepository.findActiveTodayOrderByStartDateDesc(LocalDate.now())
            .stream().map(AnnouncementDTO::from).collect(Collectors.toList());
    }

    @Transactional
    public AnnouncementDTO create(String title, String description, LocalDate startDate, LocalDate endDate, Long createdByMemberId) {
        Announcement a = Announcement.builder()
            .title(title).description(description)
            .startDate(startDate).endDate(endDate)
            .createdByMemberId(createdByMemberId)
            .build();
        return AnnouncementDTO.from(announcementRepository.save(a));
    }

    @Transactional
    public AnnouncementDTO update(Long id, String title, String description, LocalDate startDate, LocalDate endDate) {
        Announcement a = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + id));
        a.setTitle(title);
        a.setDescription(description);
        a.setStartDate(startDate);
        a.setEndDate(endDate);
        return AnnouncementDTO.from(announcementRepository.save(a));
    }

    @Transactional
    public AnnouncementDTO cancel(Long id) {
        Announcement a = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + id));
        a.setStatus(Announcement.Status.CANCELLED);
        return AnnouncementDTO.from(announcementRepository.save(a));
    }
}
