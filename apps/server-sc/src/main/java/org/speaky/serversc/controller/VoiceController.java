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
                    VoiceModel.builder().name("Korone").description("Cute doggo voice").isPublic(true).build(),
                    VoiceModel.builder().name("Aru").description("Aru voice").isPublic(true).build(),
                    VoiceModel.builder().name("Baek Jong Won").description("Paik's cuisine voice").isPublic(true)
                            .build(),
                    VoiceModel.builder().name("Child").description("Child like voice").isPublic(true).build(),
                    VoiceModel.builder().name("Trump").description("Make voice great again").isPublic(true)
                            .build(),
                    VoiceModel.builder().name("Criss").description("Criss voice").isPublic(true).build()));
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
        if (name.toLowerCase().contains("korone"))
            return "avatar_1";
        if (name.toLowerCase().contains("aru"))
            return "avatar_2";
        if (name.toLowerCase().contains("baek"))
            return "avatar_3";
        if (name.toLowerCase().contains("child"))
            return "avatar_4";
        if (name.toLowerCase().contains("trump"))
            return "avatar_5";
        if (name.toLowerCase().contains("criss"))
            return "avatar_6";
        return "avatar_1"; // Default
    }
}
