package org.speaky.serversc.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.dto.ApiResponse;
import org.speaky.serversc.dto.LoginRequest;
import org.speaky.serversc.dto.LoginResponse;
import org.speaky.serversc.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 인증 API 컨트롤러
 * 
 * Endpoints:
 * - POST /api/v1/auth/login : 로그인
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    
    private final AuthService authService;
    
    /**
     * 로그인 API
     * 
     * POST /api/v1/auth/login
     * 
     * Request:
     * {
     *   "loginId": "streamer123",
     *   "password": "password123"
     * }
     * 
     * Response 200:
     * {
     *   "success": true,
     *   "data": {
     *     "accessToken": "...",
     *     "tokenType": "Bearer",
     *     "expiresIn": 3600,
     *     "user": { "userId": 123, "loginId": "...", "nickname": "..." }
     *   },
     *   "error": null
     * }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        
        log.debug("로그인 요청: loginId={}", request.loginId());
        
        LoginResponse response = authService.login(request);
        
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
