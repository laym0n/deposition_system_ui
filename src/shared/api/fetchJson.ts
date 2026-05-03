export type FetchJsonOptions = Omit<RequestInit, 'body' | 'method'> & {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

type HeadersLike = Record<string, string>;

function getApiUrl(): string {
  // Provided by dotenv-webpack (see webpack config). Fallback is helpful for local overrides.
  return (process.env.API_URL as string | undefined) ?? 'http://158.160.194.122';
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payload?: unknown;

  constructor(params: { status: number; url: string; message: string; payload?: unknown }) {
    super(params.message);
    this.name = 'HttpError';
    this.status = params.status;
    this.url = params.url;
    this.payload = params.payload;
  }
}

export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const baseUrl = getApiUrl().replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  // Optional Bearer token (for protected endpoints). Public endpoints still work without auth.
  // Dynamic import avoids tight coupling between shared/api and auth initialization.
  let authHeader: HeadersLike | undefined;
  try {
    const mod = (await import('../auth/oidc')) as { getAccessToken?: () => Promise<string | undefined> };
    const token = await mod.getAccessToken?.();
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // ignore: auth module might not be present/initialized in some builds
  }

  const res = await fetch(url, {
    ...options,
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ?? {}),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    throw new HttpError({
      status: res.status,
      url,
      message: `HTTP ${res.status} ${res.statusText}`,
      payload: data,
    });
  }

  return data as T;
}
