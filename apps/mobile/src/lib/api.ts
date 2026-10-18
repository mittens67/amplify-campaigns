import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { File, UploadType } from 'expo-file-system';
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

function authHeaders(): Record<string, string> {
  const { token, guestId } = useSession.getState();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Guest-Id': guestId };
}

function readResponse<T>(status: number, header: (name: string) => string | null | undefined, data: any): T {
  const now = header('x-server-now');
  if (now) serverOffsetMs = new Date(now).getTime() - Date.now();
  if (status === 204) return undefined as T;
  if (status < 200 || status >= 300) {
    const err = (data as ApiErrorBody | null)?.error;
    if (status === 401 && useSession.getState().token) useSession.getState().signOut();
    throw new ApiError(status, err?.code ?? 'HTTP_' + status, err?.message ?? 'Something went wrong. Please try again.', err?.fields);
  }
  return data as T;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
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
        ...authHeaders(),
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
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. proxy error page)
  }
  return readResponse<T>(res.status, (n) => res.headers.get(n), data);
}

/**
 * Upload a local file as multipart/form-data. On Android/iOS this goes through the native
 * uploader: React Native's FormData file parts fail before reaching the network on some builds.
 */
export async function apiUpload<T>(path: string, file: { field: string; uri: string; name: string; type: string; timeoutMs?: number }): Promise<T> {
  if (Platform.OS === 'web') {
    const form = new FormData();
    form.append(file.field, await (await fetch(file.uri)).blob(), file.name);
    return api<T>(path, { method: 'POST', form, timeoutMs: file.timeoutMs });
  }
  let result: { status: number; body: string; headers: Record<string, string> };
  try {
    // The native uploader needs a file:// URI; some recorders return a bare path.
    const uri = /^[a-z]+:\/\//i.test(file.uri) ? file.uri : `file://${file.uri}`;
    result = await new File(uri).upload(API_URL + path, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: file.field,
      mimeType: file.type,
      headers: { Accept: 'application/json', ...authHeaders() },
    });
  } catch (e) {
    console.warn('[upload] failed before a response:', (e as Error)?.message);
    throw new ApiError(0, 'NETWORK', API_UNREACHABLE_HINT ?? 'Couldn’t upload the file. Check your connection and try again.');
  }
  let data: any = null;
  try {
    data = JSON.parse(result.body);
  } catch {
    // non-JSON response
  }
  const headers = Object.fromEntries(Object.entries(result.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return readResponse<T>(result.status, (n) => headers[n], data);
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
