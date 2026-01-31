// Provider utilities for data fetching

/**
 * Fetch with timeout and error handling.
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Request to ${url} timed out after ${timeout}ms`);
        }
        throw error;
    }
}

/**
 * Fetch JSON with error handling.
 */
export async function fetchJson<T>(
    url: string,
    options?: RequestInit & { timeout?: number }
): Promise<T> {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

/**
 * Retry a function with exponential backoff.
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
            }
        }
    }

    throw lastError ?? new Error("Retry failed");
}
