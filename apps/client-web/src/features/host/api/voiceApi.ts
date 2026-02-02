import { apiFetch } from "../../../shared/lib/apiFetch";

export interface Voice {
    id: number;
    name: string;
    status: 'READY' | 'LOADING' | 'ERROR';
    imageUrl?: string;
}

export const voiceApi = {
    async getVoices(): Promise<Voice[]> {
        const res = await apiFetch('/api/v1/voice-models');
        if (!res.ok) {
            throw new Error(`Failed to fetch voices: ${res.status}`);
        }
        const response = await res.json();
        return response.data.items; // ApiResponse.data.items 반환
    }
};
