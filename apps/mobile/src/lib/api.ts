import Constants from 'expo-constants';
import type { ApiErrorBody } from '@amplify/domain';
import { useSession } from './session';

function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // In development, talk to the API on the same machine that serves the JS bundle.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const API_URL = resolveApiUrl();

/**
 * `expo start --tunnel` serves the bundle from an exp.direct / ngrok address, which only forwards
 * Metro — not our API. In that case EXPO_PUBLIC_API_URL must point at a reachable API.
 */
export const API_UNREACHABLE_HINT =
  !process.env.EXPO_PUBLIC_API_URL && /exp\.direct|ngrok/.test(Constants.expoConfig?.hostUri ?? '')
    ? 'Running through an Expo tunnel: set EXPO_PUBLIC_API_URL in apps/mobile/.env to an address the phone can reach, then restart Expo.'
    : null;
if (API_UNREACHABLE_HINT) console.warn(API_UNREACHABLE_HINT);

/** Difference between the server's demo clock and this device, so deadlines read correctly. */
let serverOffsetMs = 0;
export const serverNow = () => Date.now() + serverOffsetMs;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { token, guestId } = useSession.getState();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(opts.form ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Guest-Id': guestId,
        ...opts.headers,
      },
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
  } catch {
    if (ctrl.signal.aborted) throw new ApiError(0, 'TIMEOUT', 'The server is taking too long to respond. Please try again.');
    throw new ApiError(0, 'NETWORK', API_UNREACHABLE_HINT ?? 'Can’t reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  const serverNow = res.headers.get('x-server-now');
  if (serverNow) serverOffsetMs = new Date(serverNow).getTime() - Date.now();
  if (res.status === 204) return undefined as T;
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. proxy error page)
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (res.status === 401 && token) useSession.getState().signOut();
    throw new ApiError(res.status, err?.code ?? 'HTTP_' + res.status, err?.message ?? 'Something went wrong. Please try again.', err?.fields);
  }
  return data as T;
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
