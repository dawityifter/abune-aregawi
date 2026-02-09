package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.dto.DonationDTO;
import church.abunearegawi.backend.security.FirebaseUserDetails;
import church.abunearegawi.backend.service.DonationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/donations")
@RequiredArgsConstructor
public class DonationController {

    private final DonationService donationService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Page<DonationDTO>>> getAllDonations(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(donationService.findAll(pageable)));
    }

    @GetMapping("/my-donations")
    public ResponseEntity<ApiResponse<List<DonationDTO>>> getMyDonations(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        // Assuming current user has email?
        // UserDetails has email.
        return ResponseEntity.ok(ApiResponse.success(donationService.findByDonorEmail(userDetails.getUsername()))); // Username
                                                                                                                    // is
                                                                                                                    // email
                                                                                                                    // in
                                                                                                                    // Firebase
                                                                                                                    // usually?
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> stripeWebhook(@RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        // TODO: Implement Stripe signature verification and event handling
        // For now, return 200 OK to acknowledge receipt
        log.info("Received Stripe Webhook: {}", payload);
        return ResponseEntity.ok("Received");
    }
}
