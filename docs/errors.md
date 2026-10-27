# Errors

JSON errors use `{ "error": { "type": string, "message": string, "code": string, "request_id": string, "retry_after"?: integer } }`. Every ordinary API error carries a request ID and echoes it in `X-Request-Id`. Error text excludes provider secrets and internal stack traces.

- 400 malformed/invalid parameters; 404 route or expired/missing image; 413 request body larger than configured maximum; 429 rate limit with `Retry-After`.
- 500 unexpected internal failure; 502 upstream provider failure; 503 provider/model/capacity/storage unavailable; 504 provider timeout.
- Provider usage/token fields are null when unavailable; never inferred or fabricated.

JS: `OpenMuseAPIError`, `OpenMuseRateLimitError`, `OpenMuseTimeoutError`, `OpenMuseConnectionError`. Python equivalents include `OpenMuseAPIError`, `OpenMuseRateLimitError`, `OpenMuseTimeoutError`, `OpenMuseConnectionError`. API errors include HTTP status, API code, request ID, and optional retry delay. SDKs do not retry generation requests, preventing duplicate expensive inference.
