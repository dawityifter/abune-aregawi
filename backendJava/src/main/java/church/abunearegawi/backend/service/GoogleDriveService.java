package church.abunearegawi.backend.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.InputStreamContent;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.List;

@Service
@Slf4j
public class GoogleDriveService {

    private static final String APPLICATION_NAME = "Abune Aregawi Church Backend";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    @Value("${google.drive.service-account-base64:#{null}}")
    private String dedicatedServiceAccountBase64;

    @Value("${firebase.service-account-base64:#{null}}")
    private String firebaseServiceAccountBase64;

    private Drive getDriveService() throws IOException, GeneralSecurityException {
        final NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        HttpRequestInitializer requestInitializer = getRequestInitializer();

        if (requestInitializer == null) {
            throw new IOException("No valid Google Drive credentials found.");
        }

        return new Drive.Builder(httpTransport, JSON_FACTORY, requestInitializer)
                .setApplicationName(APPLICATION_NAME)
                .build();
    }

    private HttpRequestInitializer getRequestInitializer() throws IOException {
        GoogleCredentials credentials = null;

        // Priority 1: Dedicated Service Account
        if (dedicatedServiceAccountBase64 != null && !dedicatedServiceAccountBase64.isEmpty()) {
            try {
                byte[] decoded = java.util.Base64.getDecoder().decode(dedicatedServiceAccountBase64);
                log.info("🔐 Using Dedicated Service Account for Google Drive");
                credentials = GoogleCredentials.fromStream(new ByteArrayInputStream(decoded))
                        .createScoped(Collections.singleton(DriveScopes.DRIVE));
            } catch (Exception e) {
                log.error("Failed to parse dedicated service account", e);
            }
        }

        // Priority 2: Firebase Service Account (Fallback)
        if (credentials == null && firebaseServiceAccountBase64 != null && !firebaseServiceAccountBase64.isEmpty()) {
            try {
                byte[] decoded = java.util.Base64.getDecoder().decode(firebaseServiceAccountBase64);
                log.info("🔐 Using Firebase Service Account for Google Drive");
                credentials = GoogleCredentials.fromStream(new ByteArrayInputStream(decoded))
                        .createScoped(Collections.singleton(DriveScopes.DRIVE_FILE));
            } catch (Exception e) {
                log.error("Failed to parse Firebase service account", e);
            }
        }

        if (credentials != null) {
            return new HttpCredentialsAdapter(credentials);
        }

        return null;
    }

    public List<File> listFolderImages(String folderId) throws IOException {
        try {
            Drive service = getDriveService();
            String query = String.format("'%s' in parents and mimeType contains 'image/' and trashed = false",
                    folderId);

            Drive.Files.List request = service.files().list()
                    .setQ(query)
                    .setFields("files(id, name, mimeType, webContentLink, webViewLink, thumbnailLink)")
                    .setPageSize(100)
                    .setOrderBy("createdTime desc");

            FileList result = request.execute();
            log.info("Found {} files in folder {}", result.getFiles().size(), folderId);
            return result.getFiles();
        } catch (GoogleJsonResponseException e) {
            log.error("Google Drive API Error: {}", e.getDetails().getMessage());
            throw e;
        } catch (Exception e) {
            log.error("General Drive Error", e);
            throw new IOException("Failed to list files: " + e.getMessage(), e);
        }
    }

    public File uploadImage(String folderId, MultipartFile file) throws IOException {
        try {
            Drive service = getDriveService();

            File fileMetadata = new File();
            fileMetadata.setName(file.getOriginalFilename());
            fileMetadata.setParents(Collections.singletonList(folderId));

            InputStreamContent mediaContent = new InputStreamContent(
                    file.getContentType(),
                    file.getInputStream());

            File uploadedFile = service.files().create(fileMetadata, mediaContent)
                    .setFields("id, name, webContentLink, webViewLink, thumbnailLink")
                    .execute();

            log.info("Uploaded file ID: {}", uploadedFile.getId());
            return uploadedFile;

        } catch (Exception e) {
            log.error("Upload failed", e);
            throw new IOException("Failed to upload file: " + e.getMessage(), e);
        }
    }
}
