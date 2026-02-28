package church.abunearegawi.backend.health;

import com.google.firebase.FirebaseApp;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Readiness check for Firebase connectivity.
 * Verifies the FirebaseApp is initialized and reachable.
 * This is a readiness indicator only — it does NOT affect liveness.
 */
@Component("firebase")
public class FirebaseHealthIndicator implements HealthIndicator {

    @Override
    public Health health() {
        try {
            FirebaseApp app = FirebaseApp.getInstance();
            if (app != null) {
                return Health.up()
                        .withDetail("name", app.getName())
                        .build();
            }
            return Health.down()
                    .withDetail("reason", "FirebaseApp not initialized")
                    .build();
        } catch (Exception e) {
            return Health.down()
                    .withException(e)
                    .build();
        }
    }
}
