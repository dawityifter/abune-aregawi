package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.Vendor;
import church.abunearegawi.backend.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorService {

    private final VendorRepository vendorRepository;

    @Transactional(readOnly = true)
    public Page<Vendor> findAll(Pageable pageable) {
        return vendorRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public java.util.Optional<Vendor> findById(UUID id) {
        return vendorRepository.findById(id);
    }

    @Transactional
    public Vendor create(Vendor vendor) {
        return vendorRepository.save(vendor);
    }

    @Transactional
    public Vendor update(UUID id, Vendor vendorDetails) {
        Vendor vendor = vendorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vendor not found with id: " + id));

        vendor.setName(vendorDetails.getName());
        vendor.setVendorType(vendorDetails.getVendorType());
        vendor.setContactPerson(vendorDetails.getContactPerson());
        vendor.setEmail(vendorDetails.getEmail());
        vendor.setPhoneNumber(vendorDetails.getPhoneNumber());
        vendor.setAddress(vendorDetails.getAddress());
        vendor.setWebsite(vendorDetails.getWebsite());
        vendor.setTaxId(vendorDetails.getTaxId());
        vendor.setAccountNumber(vendorDetails.getAccountNumber());
        vendor.setPaymentTerms(vendorDetails.getPaymentTerms());
        vendor.setNotes(vendorDetails.getNotes());
        // isActive is handled separately or included if passed
        vendor.setActive(vendorDetails.isActive());

        return vendorRepository.save(vendor);
    }

    @Transactional
    public void delete(UUID id) {
        vendorRepository.deleteById(id);
    }
}
