package org.speaky.serversc.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * JWT 설정 프로퍼티
 * application.yml의 jwt.* 값을 바인딩
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {
    
    /**
     * JWT 서명용 비밀키 (최소 256bit)
     */
    private String secret;
    
    /**
     * 토큰 만료 시간 (초 단위)
     */
    private int expiration;
}
