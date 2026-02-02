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
}
