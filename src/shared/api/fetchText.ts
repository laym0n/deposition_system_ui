export type FetchTextOptions = Omit<RequestInit, 'method'> & {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

type HeadersLike = Record<string, string>;

function getApiUrl(): string {
  // Provided by dotenv-webpack (see webpack config). Fallback is helpful for local overrides.
  // In local dev we use webpack-dev-server proxy to avoid CORS:
  // requests go to same-origin '/api' and are proxied to real backend.
  return (process.env.API_URL as string | undefined) ?? '/api';
}

export class HttpTextError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payloadText?: string;

  constructor(params: { status: number; url: string; message: string; payloadText?: string }) {
    super(params.message);
    this.name = 'HttpTextError';
    this.status = params.status;
    this.url = params.url;
    this.payloadText = params.payloadText;
  }
}

export async function fetchText(path: string, options: FetchTextOptions = {}): Promise<string> {
  const baseUrl = getApiUrl().replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  // Optional Bearer token (for protected endpoints).
  let authHeader: HeadersLike | undefined;
  try {
    const mod = (await import('../auth/oidc')) as { getAccessToken?: () => Promise<string | undefined> };
    const token = await mod.getAccessToken?.();
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // ignore
  }

  const res = await fetch(url, {
    ...options,
    method: options.method ?? 'GET',
    headers: {
      ...(authHeader ?? {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new HttpTextError({
      status: res.status,
      url,
      message: `HTTP ${res.status} ${res.statusText}`,
      payloadText: text,
    });
  }

  return text;
}
