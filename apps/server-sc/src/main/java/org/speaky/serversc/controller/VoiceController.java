package org.speaky.serversc.controller;

import lombok.RequiredArgsConstructor;
import org.speaky.serversc.dto.ApiResponse;
import org.speaky.serversc.dto.VoiceDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/v1/voice-models")
@RequiredArgsConstructor
public class VoiceController {

    // Hardcoded list matching server-ai/src/config/models.yaml
    private final List<VoiceDto> STATIC_VOICES = Arrays.asList(
            VoiceDto.builder().id(1L).name("Korone Voice").status("READY").build(),
            VoiceDto.builder().id(2L).name("aru_voice").status("READY").build(),
            VoiceDto.builder().id(3L).name("baekjongwon_voice").status("READY").build(),
            VoiceDto.builder().id(4L).name("child_voice").status("READY").build(),
            VoiceDto.builder().id(5L).name("trump_voice").status("READY").build(),
            VoiceDto.builder().id(6L).name("criss").status("READY").build());

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getVoices() {
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("items", STATIC_VOICES)));
    }
}
