package org.speaky.serversc.controller;

import lombok.RequiredArgsConstructor;
import org.speaky.serversc.dto.ApiResponse;
import org.speaky.serversc.dto.VoiceDto;
import org.speaky.serversc.dto.VoiceListResponseDto;
import org.speaky.serversc.domain.VoiceModel;
import org.speaky.serversc.repository.VoiceModelRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.annotation.PostConstruct;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/voice-models")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceModelRepository voiceModelRepository;

    @PostConstruct
    public void init() {
        if (voiceModelRepository.count() == 0) {
            voiceModelRepository.saveAll(Arrays.asList(
                    VoiceModel.builder().name("Korone Voice").description("Cute doggo voice").isPublic(true).build(),
                    VoiceModel.builder().name("aru_voice").description("Aru voice").isPublic(true).build(),
                    VoiceModel.builder().name("baekjongwon_voice").description("Paik's cuisine voice").isPublic(true)
                            .build(),
                    VoiceModel.builder().name("child_voice").description("Child like voice").isPublic(true).build(),
                    VoiceModel.builder().name("trump_voice").description("Make voice great again").isPublic(true)
                            .build(),
                    VoiceModel.builder().name("criss").description("Criss voice").isPublic(true).build()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<VoiceListResponseDto>> getVoices() {
        List<VoiceModel> models = voiceModelRepository.findAll();

        List<VoiceDto> dtos = models.stream()
                .map(model -> VoiceDto.builder()
                        .id(model.getId())
                        .name(model.getName())
                        .status("READY") // Default status for now
                        .imageUrl(mapImageKey(model.getName()))
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(new VoiceListResponseDto(dtos)));
    }

    private String mapImageKey(String name) {
        if (name.contains("Korone"))
            return "avatar_1";
        if (name.contains("aru"))
            return "avatar_2";
        if (name.contains("baek"))
            return "avatar_3";
        if (name.contains("child"))
            return "avatar_4";
        if (name.contains("trump"))
            return "avatar_1";
        return "avatar_2"; // Default
    }
}
