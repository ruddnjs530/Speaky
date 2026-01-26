const KEY = "sc.clientId.v1";

// 탭/디바이스 단위 고정 clientId (세션 동안 불변)
export function getOrCreateClientId(prefix = "web"): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 6) return existing;

    const id = `${prefix}-${safeRandomId(12)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // localStorage 불가 환경 대비
    return `${prefix}-${safeRandomId(12)}`;
  }
}

function safeRandomId(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(len))
      : undefined;

  for (let i = 0; i < len; i++) {
    const n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
    out += chars[n % chars.length];
  }
  return out;
}
