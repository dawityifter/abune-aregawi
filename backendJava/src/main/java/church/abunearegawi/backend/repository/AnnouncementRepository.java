package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    List<Announcement> findAllByOrderByStartDateDesc();

    List<Announcement> findByStatusOrderByStartDateDesc(Announcement.Status status);

    @Query("SELECT a FROM Announcement a WHERE a.status = 'ACTIVE' AND a.startDate <= :today AND a.endDate >= :today ORDER BY a.startDate DESC")
    List<Announcement> findActiveTodayOrderByStartDateDesc(LocalDate today);

    @Query("SELECT a FROM Announcement a WHERE a.status = 'ACTIVE' AND a.endDate < :today ORDER BY a.startDate DESC")
    List<Announcement> findExpiredOrderByStartDateDesc(LocalDate today);
}
