package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Donation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface DonationRepository extends JpaRepository<Donation, Long> {

    Donation findByStripePaymentIntentId(String stripePaymentIntentId);

    Page<Donation> findByDonorEmail(String donorEmail, Pageable pageable);

    // Changed from findByIsRecurring to findByDonationType
    Page<Donation> findByDonationType(Donation.DonationType donationType, Pageable pageable);

    Page<Donation> findByStatus(Donation.Status status, Pageable pageable);
}
