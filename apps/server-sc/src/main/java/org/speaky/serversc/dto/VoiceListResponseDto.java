package org.speaky.serversc.dto;

import java.util.List;
import lombok.*;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class VoiceListResponseDto {
    private List<VoiceDto> items;
}
