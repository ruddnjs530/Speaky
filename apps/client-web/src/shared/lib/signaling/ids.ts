export function newRequestId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    // fallback
    return `req-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
