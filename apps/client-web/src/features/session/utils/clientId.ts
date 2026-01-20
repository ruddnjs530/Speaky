export function getOrCreateClientId(): string {
    const key = "clientId:v1";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;

    // 표준 UUID v4 생성
    const uuid = crypto.randomUUID(); // ex: 550e8400-e29b-41d4-a716-446655440000
    const short = uuid.split("-")[0]; // 앞 8글자

    const id = `web-${short}`;
    sessionStorage.setItem(key, id);
    return id;
}
