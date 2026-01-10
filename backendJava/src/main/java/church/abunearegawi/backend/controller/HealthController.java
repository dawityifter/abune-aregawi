package church.abunearegawi.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/ready")
    public Map<String, Object> ready() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Java backend is ready");
        response.put("version", "1.0.0-SpringBoot4");
        return response;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        return response;
    }
}
