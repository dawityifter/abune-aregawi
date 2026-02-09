package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Vendor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface VendorRepository extends JpaRepository<Vendor, UUID> {
    java.util.List<Vendor> findByIsActiveOrderByNameAsc(boolean isActive);
    java.util.List<Vendor> findAllByOrderByNameAsc();
}
