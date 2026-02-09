package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.model.Vendor;
import church.abunearegawi.backend.service.VendorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/vendors")
@RequiredArgsConstructor
public class VendorController {

    private final VendorService vendorService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<java.util.List<Vendor>>> getAllVendors(
            @RequestParam(name = "is_active", required = false) Boolean isActive) {
        return ResponseEntity.ok(ApiResponse.success(vendorService.findAll(isActive)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER', 'SECRETARY')")
    public ResponseEntity<ApiResponse<Vendor>> getVendorById(@PathVariable UUID id) {
        return vendorService.findById(id)
                .map(vendor -> ResponseEntity.ok(ApiResponse.success(vendor)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Vendor>> createVendor(@RequestBody Vendor vendor) {
        Vendor created = vendorService.create(vendor);
        return ResponseEntity.created(URI.create("/api/vendors/" + created.getId()))
                .body(ApiResponse.success(created, "Vendor created successfully"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Vendor>> updateVendor(
            @PathVariable UUID id,
            @RequestBody Vendor vendor) {
        Vendor updated = vendorService.update(id, vendor);
        return ResponseEntity.ok(ApiResponse.success(updated, "Vendor updated successfully"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TREASURER')")
    public ResponseEntity<ApiResponse<Void>> deleteVendor(@PathVariable UUID id) {
        vendorService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Vendor deleted successfully"));
    }
}
