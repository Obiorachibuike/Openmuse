# API reference

Canonical contract: `openapi/openapi.json`, served at `/api/v1/openapi.json`. The production API is at `https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1`. No API key is required.

| Method/path | Body | Response |
|---|---|---|
| `GET /health` | — | `{status, service, version, timestamp}` |
| `GET /models` | — | `{object:"list",data:[...]}` configured capability models only |
| `GET /metadata` | — | current public request limits and image storage mode |
| `POST /text` | `{prompt, model?, max_tokens?, temperature?}` | `text.generation`, `output.text`, token usage or `null` |
| `POST /chat` | `{messages, model?, max_tokens?, temperature?}` | `chat.completion`, assistant choice, actual usage or `null` |
| `POST /chat/stream` | same chat body (string message content) | SSE events; actual upstream incremental stream |
| `POST /images/generations` | `{prompt, model?, size?}` | 201 and retrievable relative image path |
| `GET /images/{id}` | — | image bytes, immutable cache header, 404 when absent/expired |
| `POST /vision` | `{image_url? or image_data?, prompt, model?}` | `vision.analysis` |

Chat messages accept the `system`, `user`, or `assistant` role and non-empty text as a string or arrays of `{type:"text",text:"..."}` parts; chat streaming currently requires string message content. Default model resolves only to an environment-configured and credentialed model for the requested capability. Names: `OPENMUSE_TEXT_MODEL`, `OPENMUSE_VISION_MODEL`, `OPENMUSE_IMAGE_MODEL`. Models may be the same provider model. Each listing includes its non-secret provider adapter category, availability, verified capabilities, stream support, and safe parameter limits. Provider requests use `OPENAI_BASE_URL` and `OPENAI_API_KEY` server-side. Parameter limits: `max_tokens` 1..4096, `temperature` 0..2. Image sizes accepted: 256x256, 512x512, 1024x1024, 1024x1536, and 1536x1024.

Image URLs are fetched through a guarded backend fetch: HTTP(S) only, public DNS addresses only, no credentials, at most 3 redirects, 8-second timeout, supported image types, 5 MiB maximum. Base64 data URLs accept PNG/JPEG/WebP/GIF up to 5 MiB. Redirect targets are validated again. Retrieval IDs are high-entropy and format-checked.

Error format: `{ "error": { "type": "...", "message": "...", "code": "...", "request_id": "..." } }`; may contain `retry_after`. Request IDs are echoed in `X-Request-Id`. Statuses: 400 validation, 404 missing route/image, 413 body too large, 429 rate limited, 500 unexpected error, 502 provider error, 503 provider/capacity unavailable, 504 timeout. Provider internals are deliberately not returned.

All operation examples in the root README and SDK READMEs reflect the package interfaces. The playground makes live requests and never supplies mocked API results.
