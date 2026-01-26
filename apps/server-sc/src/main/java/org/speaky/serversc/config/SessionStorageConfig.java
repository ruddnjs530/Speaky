package org.speaky.serversc.config;

import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.service.SessionService;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * 세션 저장소 설정
 * 
 * - 세션 TTL 및 정리 스케줄 설정
 * - 향후 Redis/DB 전환 시 조건부 Bean 생성 추가 가능
 */
@Slf4j
@Configuration
@EnableScheduling
public class SessionStorageConfig {
    
    private final SessionService sessionService;
    
    public SessionStorageConfig(SessionService sessionService) {
        this.sessionService = sessionService;
        log.info("SessionStorageConfig initialized with In-Memory storage");
    }
    
    /**
     * 주기적으로 종료된 세션 정리 (ENDED, FAILED 상태)
     * 기본: 5분마다 실행
     */
    @Scheduled(fixedRateString = "${session.cleanup.interval.minutes:5}000", initialDelay = 60000)
    public void cleanupCompletedSessions() {
        log.debug("Running scheduled session cleanup task");
        int deletedCount = sessionService.cleanupCompletedSessions();
        
        if (deletedCount > 0) {
            log.info("Session cleanup completed: {} sessions removed", deletedCount);
        }
    }
}
