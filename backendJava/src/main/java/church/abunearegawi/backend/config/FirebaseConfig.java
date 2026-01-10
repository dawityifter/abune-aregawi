package church.abunearegawi.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;

@Configuration
public class FirebaseConfig {

    @Value("${FIREBASE_SERVICE_ACCOUNT_BASE64:}")
    private String firebaseServiceAccountBase64;

    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        if (FirebaseApp.getApps().isEmpty()) {
            if (firebaseServiceAccountBase64 == null || firebaseServiceAccountBase64.isEmpty()) {
                System.err.println(
                        "❌ FIREBASE_SERVICE_ACCOUNT_BASE64 not configured. Firebase authentication will not work.");
                throw new IllegalStateException("Firebase service account not configured");
            }

            byte[] decodedKey = Base64.getDecoder().decode(firebaseServiceAccountBase64);
            ByteArrayInputStream serviceAccount = new ByteArrayInputStream(decodedKey);

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();

            FirebaseApp app = FirebaseApp.initializeApp(options);
            System.out.println("✅ Firebase Admin SDK initialized successfully");
            return app;
        }
        return FirebaseApp.getInstance();
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }
}
