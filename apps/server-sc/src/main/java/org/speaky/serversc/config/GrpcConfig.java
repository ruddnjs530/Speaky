package org.speaky.serversc.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PreDestroy;

/**
 * gRPC 클라이언트 설정
 * 
 * MediaServerClient가 사용할 ManagedChannel을 Spring Bean으로 관리합니다.
 * SSL/TLS 설정을 프로퍼티로 제어할 수 있습니다.
 */
@Slf4j
@Configuration
public class GrpcConfig {
    
    private ManagedChannel channel;
    
    @Bean
    public ManagedChannel mediaServerChannel(
            @Value("${media.server.host:localhost}") String host,
            @Value("${media.server.port:8081}") int port,
            @Value("${media.server.ssl.enabled:false}") boolean sslEnabled) {
        
        log.info("Creating gRPC channel: host={}, port={}, ssl={}", host, port, sslEnabled);
        
        ManagedChannelBuilder<?> builder = ManagedChannelBuilder.forAddress(host, port);
        
        if (sslEnabled) {
            builder.useTransportSecurity();
            log.info("gRPC channel configured with TLS");
        } else {
            builder.usePlaintext();
            log.warn("gRPC channel configured WITHOUT TLS (development mode)");
        }
        
        this.channel = builder.build();
        return this.channel;
    }
    
    @PreDestroy
    public void shutdown() {
        if (channel != null && !channel.isShutdown()) {
            log.info("Shutting down gRPC channel...");
            channel.shutdown();
            
            try {
                if (!channel.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)) {
                    log.warn("gRPC channel did not terminate gracefully, forcing shutdown...");
                    channel.shutdownNow();
                    
                    if (!channel.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)) {
                        log.error("gRPC channel failed to terminate");
                    }
                }
            } catch (InterruptedException e) {
                log.error("Interrupted while shutting down gRPC channel", e);
                channel.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
