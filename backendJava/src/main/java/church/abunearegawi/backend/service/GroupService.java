package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.GroupDTO;
import church.abunearegawi.backend.model.Group;
import church.abunearegawi.backend.repository.GroupRepository;
import church.abunearegawi.backend.repository.MemberGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final MemberGroupRepository memberGroupRepository;

    @Transactional(readOnly = true)
    public List<GroupDTO> listActive(boolean includeCounts) {
        List<Group> groups = groupRepository.findByIsActiveTrueOrderByNameAsc();
        Map<Long, Long> countsMap = new java.util.HashMap<>();

        if (includeCounts) {
            List<Object[]> counts = memberGroupRepository.countMembersPerGroup();
            for (Object[] row : counts) {
                Long groupId = (Long) row[0];
                Long count = (Long) row[1];
                countsMap.put(groupId, count);
            }
        }

        return groups.stream().map(g -> {
            Long count = includeCounts ? countsMap.getOrDefault(g.getId(), 0L) : null;
            return toDTO(g, count);
        }).collect(Collectors.toList());
    }

    private GroupDTO toDTO(Group g, Long count) {
        String label = g.getName();
        if (count != null) {
            label += " (" + count + " member" + (count == 1 ? "" : "s") + ")";
        }
        if (g.getDescription() != null && !g.getDescription().isEmpty()) {
            label += " — " + g.getDescription();
        }

        return new GroupDTO(
                g.getId(),
                g.getName(),
                g.getDescription(),
                count,
                label,
                g.getCreatedAt(),
                g.getUpdatedAt());
    }
}
