package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.Pledge;
import church.abunearegawi.backend.service.PledgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/pledges")
@RequiredArgsConstructor
public class PledgeController {

    private final PledgeService pledgeService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Page<Pledge>>> getAllPledges(
            @RequestParam(required = false) Pledge.Status status,
            @RequestParam(required = false) Pledge.PledgeType pledgeType,
            @RequestParam(required = false) String eventName,
            @RequestParam(required = false) Long memberId,
            Pageable pageable) {
        Page<Pledge> pledges = pledgeService.findAll(status, pledgeType, eventName, memberId, pageable);
        return ResponseEntity.ok(ApiResponse.success(pledges));
    }

    @GetMapping("/member/{memberId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY') or #memberId == authentication.principal.memberId")
    public ResponseEntity<ApiResponse<Page<Pledge>>> getPledgesByMember(
            @PathVariable Long memberId,
            Pageable pageable) {
        Page<Pledge> pledges = pledgeService.findByMemberId(memberId, pageable);
        return ResponseEntity.ok(ApiResponse.success(pledges));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Pledge>> getPledgeById(@PathVariable Long id) {
        return pledgeService.findById(id)
                .map(pledge -> ResponseEntity.ok(ApiResponse.success(pledge)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Pledge>> createPledge(@RequestBody Map<String, Object> request) {
        // Extract pledge data
        Pledge pledge = new Pledge();
        if (request.get("amount") != null) {
            pledge.setAmount(new java.math.BigDecimal(request.get("amount").toString()));
        }
        if (request.get("currency") != null) {
            pledge.setCurrency(request.get("currency").toString());
        }
        if (request.get("pledge_type") != null) {
            try {
                pledge.setPledgeType(Pledge.PledgeType.valueOf(request.get("pledge_type").toString()));
            } catch (IllegalArgumentException e) {
                pledge.setPledgeType(Pledge.PledgeType.general);
            }
        }
        if (request.get("event_name") != null) {
            pledge.setEventName(request.get("event_name").toString());
        }
        if (request.get("due_date") != null) {
            pledge.setDueDate(java.time.LocalDateTime.parse(request.get("due_date").toString()));
        }
        if (request.get("first_name") != null) {
            pledge.setFirstName(request.get("first_name").toString());
        }
        if (request.get("last_name") != null) {
            pledge.setLastName(request.get("last_name").toString());
        }
        if (request.get("email") != null) {
            pledge.setEmail(request.get("email").toString());
        }
        if (request.get("phone") != null) {
            pledge.setPhone(request.get("phone").toString());
        }
        if (request.get("address") != null) {
            pledge.setAddress(request.get("address").toString());
        }
        if (request.get("zip_code") != null) {
            pledge.setZipCode(request.get("zip_code").toString());
        }
        if (request.get("notes") != null) {
            pledge.setNotes(request.get("notes").toString());
        }
        if (request.get("metadata") != null && request.get("metadata") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) request.get("metadata");
            pledge.setMetadata(metadata);
        }

        String email = request.get("email") != null ? request.get("email").toString() : null;
        String phone = request.get("phone") != null ? request.get("phone").toString() : null;

        Pledge created = pledgeService.create(pledge, email, phone);
        return ResponseEntity.created(URI.create("/api/pledges/" + created.getId()))
                .body(ApiResponse.success(created, "Pledge created successfully"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Pledge>> updatePledge(
            @PathVariable Long id,
            @RequestBody Pledge pledge) {
        Pledge updated = pledgeService.update(id, pledge);
        return ResponseEntity.ok(ApiResponse.success(updated, "Pledge updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePledge(@PathVariable Long id) {
        pledgeService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Pledge deleted successfully"));
    }
}

