export class OpenMuseError extends Error {
  constructor(message: string, options?: ErrorOptions) { super(message, options); this.name = new.target.name; }
}
export class OpenMuseAPIError extends OpenMuseError {
  constructor(message: string, readonly status: number, readonly code?: string, readonly requestId?: string, readonly retryAfter?: number, readonly type?: string) { super(message); }
}
export class OpenMuseRateLimitError extends OpenMuseAPIError {}
export class OpenMuseTimeoutError extends OpenMuseError {}
export class OpenMuseConnectionError extends OpenMuseError {}
