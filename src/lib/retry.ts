/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delayMs = 1000, onRetry } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (i === retries - 1) throw error;

      const delay = delayMs * Math.pow(2, i);
      onRetry?.(i + 1, error);
      console.warn(`Retry ${i + 1}/${retries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}
