package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.SmsLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SmsLogRepository extends JpaRepository<SmsLog, Long> {
    Page<SmsLog> findBySenderId(Long senderId, Pageable pageable);
    Page<SmsLog> findByRecipientType(SmsLog.RecipientType recipientType, Pageable pageable);
}

