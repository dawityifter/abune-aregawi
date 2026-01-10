package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.DonationDTO;
import church.abunearegawi.backend.model.Donation;
import church.abunearegawi.backend.repository.DonationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DonationService {

    private final DonationRepository donationRepository;

    @Transactional(readOnly = true)
    public DonationDTO findByStripePaymentIntentId(String id) {
        Donation donation = donationRepository.findByStripePaymentIntentId(id);
        if (donation == null)
            return null;
        return toDTO(donation);
    }

    @Transactional(readOnly = true)
    public Page<DonationDTO> findAll(Pageable pageable) {
        return donationRepository.findAll(pageable)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public List<DonationDTO> findByDonorEmail(String email) {
        // Assuming pageable is not strictly needed for this list view, using unpaged or
        // large page
        return donationRepository.findByDonorEmail(email, Pageable.unpaged())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DonationDTO> findRecurring(boolean isRecurring) {
        Donation.DonationType type = isRecurring ? Donation.DonationType.RECURRING : Donation.DonationType.ONE_TIME;
        return donationRepository.findByDonationType(type, Pageable.unpaged())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // toDTO method omitted for brevity, but needed if this overwrites entire file?
    // Wait, write_to_file overwrites. I need to include the FULL implementation.
    // I need the mapper code from previous version.

    private DonationDTO toDTO(Donation d) {
        return new DonationDTO(
                d.getId(),
                d.getStripePaymentIntentId(),
                d.getStripeCustomerId(),
                d.getAmount(),
                d.getCurrency(),
                d.getDonationType() != null ? d.getDonationType().name() : null,
                d.getFrequency() != null ? d.getFrequency().name() : null,
                d.getPaymentMethod() != null ? d.getPaymentMethod().name() : null,
                d.getStatus() != null ? d.getStatus().name() : null,
                d.getDonorFirstName(),
                d.getDonorLastName(),
                d.getDonorEmail(),
                d.getDonorPhone(),
                d.getDonorAddress(),
                d.getDonorZipCode(),
                d.getMetadata(),
                d.getCreatedAt(),
                d.getUpdatedAt());
    }
}
