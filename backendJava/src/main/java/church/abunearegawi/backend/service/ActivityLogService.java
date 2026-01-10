package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.ActivityLogDTO;
import church.abunearegawi.backend.model.ActivityLog;
import church.abunearegawi.backend.repository.ActivityLogRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    @Transactional(readOnly = true)
    public Page<ActivityLogDTO> findAll(
            Integer page,
            Integer limit,
            Long userId,
            String action,
            String entityType,
            String startDate,
            String endDate) {
        // Default to page 0, limit 20
        int pageNum = page != null ? Math.max(0, page - 1) : 0;
        int pageSize = limit != null ? Math.max(1, limit) : 20;

        Pageable pageable = PageRequest.of(pageNum, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<ActivityLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (userId != null) {
                predicates.add(cb.equal(root.get("actor").get("id"), userId));
            }

            if (action != null && !action.isBlank()) {
                predicates.add(cb.like(root.get("action"), "%" + action + "%"));
            }

            if (entityType != null && !entityType.isBlank()) {
                predicates.add(cb.equal(root.get("entityType"), entityType));
            }

            if (startDate != null && !startDate.isBlank()) {
                try {
                    LocalDateTime start = LocalDateTime.parse(startDate, DateTimeFormatter.ISO_DATE_TIME);
                    predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), start));
                } catch (Exception e) {
                    // Ignore invalid date
                }
            }

            if (endDate != null && !endDate.isBlank()) {
                try {
                    LocalDateTime end = LocalDateTime.parse(endDate, DateTimeFormatter.ISO_DATE_TIME);
                    predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), end));
                } catch (Exception e) {
                    // Ignore invalid date
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return activityLogRepository.findAll(spec, pageable)
                .map(ActivityLogDTO::fromEntity);
    }
}
