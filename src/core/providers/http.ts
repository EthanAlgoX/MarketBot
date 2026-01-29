export interface HttpClientOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  options: HttpClientOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 20_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 500)}`);
    }

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
