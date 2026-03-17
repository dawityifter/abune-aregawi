package church.abunearegawi.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "OK");
        response.put("timestamp", java.time.Instant.now().toString());
        response.put("version", "1.0.0-SpringBoot4");
        return response;
    }

    @GetMapping("/api/health")
    public Map<String, Object> apiHealth() {
        return health();
    }

    @GetMapping("/api/ready")
    public Map<String, Object> ready() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Java backend is ready");
        response.put("version", "1.0.0-SpringBoot4");
        return response;
    }
}
