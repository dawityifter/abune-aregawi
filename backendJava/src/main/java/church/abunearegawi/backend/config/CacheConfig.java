package church.abunearegawi.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.cache.CaffeineCacheMetrics;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    @ConfigurationProperties(prefix = "cache")
    public CacheProperties cacheProperties() {
        return new CacheProperties();
    }

    @Bean
    public CacheManager cacheManager(CacheProperties props, MeterRegistry registry) {
        SimpleCacheManager manager = new SimpleCacheManager();

        var caches = props.getSpecs().entrySet().stream()
                .map(entry -> buildCache(entry.getKey(), entry.getValue(), registry))
                .toList();

        manager.setCaches(caches);
        return manager;
    }

    private CaffeineCache buildCache(String name, CacheSpec spec, MeterRegistry registry) {
        var nativeCache = Caffeine.newBuilder()
                .expireAfterWrite(spec.getTtl(), TimeUnit.SECONDS)
                .maximumSize(spec.getMaxSize())
                .recordStats()
                .build();

        CaffeineCacheMetrics.monitor(registry, nativeCache, name);

        return new CaffeineCache(name, nativeCache);
    }

    public static class CacheProperties {
        private Map<String, CacheSpec> specs = Map.of();

        public Map<String, CacheSpec> getSpecs() { return specs; }
        public void setSpecs(Map<String, CacheSpec> specs) { this.specs = specs; }
    }

    public static class CacheSpec {
        private long ttl = 300;
        private long maxSize = 500;

        public long getTtl() { return ttl; }
        public void setTtl(long ttl) { this.ttl = ttl; }
        public long getMaxSize() { return maxSize; }
        public void setMaxSize(long maxSize) { this.maxSize = maxSize; }
    }
}
