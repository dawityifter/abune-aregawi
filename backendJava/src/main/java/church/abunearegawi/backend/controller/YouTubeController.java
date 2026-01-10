package church.abunearegawi.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/youtube")
public class YouTubeController {

    @GetMapping("/multi-live-status")
    public Map<String, Object> getMultiLiveStatus() {
        // Stub implementation to fix 404 errors
        // TODO: Implement actual YouTube API logic
        return Map.of(
                "isLive", false,
                "channelId", "",
                "videoId", "",
                "title", "",
                "thumbnailUrl", "");
    }
}
