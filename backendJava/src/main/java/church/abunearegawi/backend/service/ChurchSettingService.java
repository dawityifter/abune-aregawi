package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.ChurchSetting;
import church.abunearegawi.backend.repository.ChurchSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChurchSettingService {

    private final ChurchSettingRepository churchSettingRepository;
    private static final String TV_INTERVAL_KEY = "tv_rotation_interval_seconds";

    public int getTvRotationInterval() {
        return churchSettingRepository.findById(TV_INTERVAL_KEY)
            .map(s -> Integer.parseInt(s.getValue()))
            .orElse(30);
    }

    @Transactional
    public int setTvRotationInterval(int seconds) {
        if (seconds < 5 || seconds > 300) throw new IllegalArgumentException("seconds must be 5-300");
        ChurchSetting setting = churchSettingRepository.findById(TV_INTERVAL_KEY)
            .orElse(ChurchSetting.builder().key(TV_INTERVAL_KEY).build());
        setting.setValue(String.valueOf(seconds));
        churchSettingRepository.save(setting);
        return seconds;
    }
}
