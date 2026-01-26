export function buildWsUrl(baseWsUrl: string, token: string): string {
    // 임시 합의: query param token
    const u = new URL(baseWsUrl);
    u.searchParams.set("token", token);
    return u.toString();
}
