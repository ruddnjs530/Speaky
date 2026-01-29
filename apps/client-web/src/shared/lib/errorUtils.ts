/**
 * 에러 객체에서 code 속성을 안전하게 추출합니다.
 */
export function getErrorCode(e: unknown): string | undefined {
    if (typeof e === 'object' && e !== null && 'code' in e) {
        const code = (e as { code?: unknown }).code;
        return typeof code === 'string' ? code : undefined;
    }
    return undefined;
}
/**
 * 에러 객체에서 message 속성을 안전하게 추출합니다.
 */
export function getErrorMessage(e: unknown): string | undefined {
    if (typeof e === 'object' && e !== null && 'message' in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === 'string' ? msg : undefined;
    }
    return undefined;
}