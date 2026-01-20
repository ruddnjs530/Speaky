function randomHex(n: number) {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Spec: "web-" + UUID v4(앞 8글자) 형태
 * - 완전한 UUID v4 문자열을 만들 필요 없이, "앞 8글자" 요구만 충족하도록 안전한 랜덤 hex 사용
 * - 탭 단위 불변성은 sessionStorage로 보장
 */
export function getOrCreateClientId(): string {
    const key = "clientId:v1";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;

    const id = `web-${randomHex(4)}`; // 8 hex chars
    sessionStorage.setItem(key, id);
    return id;
}
