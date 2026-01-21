import { getAccessToken } from "../../../shared/lib/authToken";

export function authHeaders(): HeadersInit {
    const token = getAccessToken();

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}
