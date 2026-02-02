package org.speaky.serversc.dto;

import java.util.List;

public class VoiceListResponseDto {
    private List<VoiceDto> items;

    public VoiceListResponseDto(List<VoiceDto> items) {
        this.items = items;
    }

    public List<VoiceDto> getItems() {
        return items;
    }

    public void setItems(List<VoiceDto> items) {
        this.items = items;
    }
}
