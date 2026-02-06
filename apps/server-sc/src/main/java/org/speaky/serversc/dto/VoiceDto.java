package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceDto {
    private Long id;
    private String name;
    private String status; // "READY", "LOADING", "ERROR"
    private String imageUrl; // Optional
    private String modelPath;
    private String indexPath;
    private Double indexRate;
    private Integer pitch;
    private Double protect;
    private Double rmsMixRate;
    private String device;
}
