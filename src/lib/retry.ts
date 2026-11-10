/** Pause for the specified number of milliseconds. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** HTTP failure carrying its numeric status code for retry decisions. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Retry transient failures with exponential delay and jitter in milliseconds; attempts are bounded. */
export async function retry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 5;
  for (let i = 0; ; i++) {
    try {
      return await operation();
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error ? Number(error.status) : null;
      if (
        i >= attempts - 1 ||
        (status !== null && Number.isFinite(status) && status !== 429 && status < 500)
      )
        throw error;
      await (options.sleep ?? sleep)(
        Math.ceil(500 * 2 ** i + (options.random ?? Math.random)() * 250),
      );
    }
  }
}
/** Fetch JSON with transient-failure backoff and a request timeout in milliseconds. */
export async function fetchJson<T>(url: string, init?: RequestInit, fetcher = fetch): Promise<T> {
  return retry(async () => {
    const response = await fetcher(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw new HttpError(response.status, `${response.status} fetching ${url.split('?')[0]}`);
    return response.json() as Promise<T>;
  });
}
