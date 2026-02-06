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

    @GetMapping
    public ResponseEntity<ApiResponse<VoiceListResponseDto>> getVoices() {
        List<VoiceModel> models = voiceModelRepository.findAll();

        List<VoiceDto> dtos = models.stream()
                .map(model -> VoiceDto.builder()
                        .id(model.getId())
                        .name(model.getName())
                        // .description(model.getDescription())
                        .status("READY")
                        .imageUrl(model.getSampleUri()) // Use seeded sampleUri
                        .modelPath(model.getModelPath())
                        .indexPath(model.getIndexPath())
                        .indexRate(model.getIndexRate())
                        .pitch(model.getPitch())
                        .protect(model.getProtect())
                        .rmsMixRate(model.getRmsMixRate())
                        .device(model.getDevice())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(new VoiceListResponseDto(dtos)));
    }
}
