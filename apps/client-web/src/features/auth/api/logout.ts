import { clearAccessToken } from '../../../shared/lib/authToken';

export function logout() {
  clearAccessToken();
}
