package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.GoogleDriveService;
import com.google.api.services.drive.model.File;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/gallery")
@RequiredArgsConstructor
public class GalleryController {

    private final GoogleDriveService googleDriveService;

    @GetMapping("/{folderId}")
    public ResponseEntity<ApiResponse<List<File>>> getFolderImages(@PathVariable String folderId) {
        try {
            List<File> files = googleDriveService.listFolderImages(folderId);
            return ResponseEntity.ok(ApiResponse.success(files));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("Failed to fetch gallery images: " + e.getMessage()));
        }
    }

    @PostMapping("/{folderId}/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'SECRETARY', 'CHURCH_LEADERSHIP')")
    public ResponseEntity<ApiResponse<File>> uploadImage(
            @PathVariable String folderId,
            @RequestParam("file") MultipartFile file) {
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("No file uploaded"));
            }
            File uploadedFile = googleDriveService.uploadImage(folderId, file);
            return ResponseEntity.status(201).body(ApiResponse.success(uploadedFile, "Image uploaded successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error("Failed to upload image: " + e.getMessage()));
        }
    }
}
