# OpenMuse

OpenMuse is a public, keyless-by-default AI HTTP API with official TypeScript/JavaScript and Python SDK source packages. It exposes text, chat, genuine incremental SSE chat, image generation/retrieval, vision, model discovery, health, service metadata, and OpenAPI 3.1. The repository was initially a README-only checkout; the implementation now provides the platform foundation, rather than a replacement for any existing application code.

**Production API base URL:** `https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1` (the existing deployment URL supplied with this project). Runtime availability/provider configuration has not been assumed; consult the limitations below. Public access is subject to operator infrastructure, rate limits, and capacity. It is not unlimited free inference.

## Features

- Hono TypeScript API and responsive documentation/playground UI.
- OpenAI-compatible provider adapter configured only on the server. No model is advertised unless configured.
- Per-process IP throttling, stricter expensive-route throttling, concurrency guard, body limits, timeouts, request IDs, parameter validation, and consistent error envelope.
- Optional durable S3-compatible image storage; process-memory fallback is explicitly non-durable.
- Official installable-source SDKs at `packages/javascript` and `packages/python`, including resource APIs and streaming SSE parsers.
- Public OpenAPI route: `/openapi.json`.

## Direct REST quickstart

```sh
curl https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/health
curl https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/models
curl -X POST https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/text \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Explain machine learning in simple terms."}'
```

Text response shape includes `id`, `object`, `created`, actual provider `model`, `output.text`, and usage fields. Token measurements are `null` if the upstream provider did not supply them. If no provider model/credential is configured, a generation endpoint returns a structured 503 and `/models` returns an empty list.

## JavaScript / TypeScript SDK

Package: `@openmuse-ai/sdk` (v1.0.0 source; npm publication **not performed**). Build and install locally:

```sh
npm install
npm run build:sdk
npm install ./packages/javascript
```

```ts
import { OpenMuse } from '@openmuse-ai/sdk';
const muse = new OpenMuse();
const result = await muse.text.generate({ prompt: 'Explain REST APIs simply.' });
console.log(result.output.text);
const chat = await muse.chat.create({ messages: [{ role: 'user', content: 'What is TypeScript?' }] });
for await (const event of muse.chat.stream({ messages: [{ role: 'user', content: 'Explain neural networks.' }] })) {
  if (event.type === 'content_delta') process.stdout.write(event.text);
}
const image = await muse.images.generate({ prompt: 'A quiet futuristic city.' });
const imageBytes = await (await muse.images.retrieve(image.data[0]!.id)).arrayBuffer();
const vision = await muse.vision.analyze({ image_url: 'https://example.org/image.jpg', prompt: 'Describe it.' });
const models = await muse.models.list();
const health = await muse.health.check();
```

Custom base URL: `new OpenMuse({ baseURL: 'http://localhost:3000/api/v1', timeout: 30_000 })`. Requests accept `{ signal }` as the second argument. Generation calls are not retried automatically.

## Python SDK

Package: `openmuse-ai` (v1.0.0 source; PyPI publication **not performed**). Install from repository:

```sh
python -m pip install ./packages/python
```

```python
from openmuse import OpenMuse
with OpenMuse() as muse:
    result = muse.text.generate(prompt="Explain APIs to a beginner.")
    print(result.output.text)
    chat = muse.chat.create(messages=[{"role": "user", "content": "What is Python?"}])
    for event in muse.chat.stream(messages=[{"role": "user", "content": "Explain databases."}]):
        if event.type == "content_delta": print(event.text, end="", flush=True)
    image = muse.images.generate(prompt="A peaceful future city.")
    png_bytes = muse.images.retrieve(image.data[0].id).content
    analysis = muse.vision.analyze(image_url="https://example.org/image.jpg", prompt="Describe it.")
    models = muse.models.list()
    health = muse.health.check()
```

Set `base_url="http://localhost:3000/api/v1"` for local/self-hosted service. Python client is synchronous, supports context management and custom httpx transport.

## API endpoints

All paths are prefixed with `/api/v1`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Lightweight service/version/timestamp status; does not reveal provider secrets or promise inference readiness |
| GET | `/models` | Configured models and verified capabilities only |
| GET | `/metadata` | Public limits and storage mode |
| POST | `/text` | Text generation `{prompt, model?, max_tokens?, temperature?}` |
| POST | `/chat` | Chat `{messages, model?, max_tokens?, temperature?}` |
| POST | `/chat/stream` | Genuine provider-incremental chat stream via SSE |
| POST | `/images/generations` | Generate then persist image metadata and bytes |
| GET | `/images/{id}` | Retrieve image bytes (proxy path; immutable cache header) |
| POST | `/vision` | Analyze public `image_url` or base64 image data URL |
| GET | `/openapi.json` | OpenAPI 3.1 document |

Default model resolves to the configured model for a capability; unsupported model/capability requests are not silently rerouted. Limits: temperature 0–2, max_tokens 1–4096, supported image sizes are listed in the API schema. Input and body limits are enforced. URL-based vision fetches are limited by size, duration, redirects, supported image type, and DNS/IP validation; base64 data URLs are also accepted. See `docs/api-reference.md`, `docs/examples.md`, and `openapi/openapi.json` for the complete request/response/error contract and per-endpoint cURL/SDK examples.

### Streaming

`/chat/stream` relays actual upstream OpenAI-compatible SSE delta events incrementally and emits `message_start`, `content_delta`, `message_end`, `error`, and `[DONE]`. It does not synthesize a stream from a buffered answer. It requires provider-native stream support and explicit operator confirmation by setting `OPENMUSE_TEXT_STREAMING_ENABLED=true`; without that flag, the model is not advertised as streaming-capable and the stream route returns 503. The adapter targets OpenAI-compatible `chat/completions` streaming; unsupported upstreams may fail. No provider credentials means a 503 before stream startup.

### Errors and limits

Errors use `{ "error": { "type", "message", "code", "request_id" } }`. Statuses include 400, 404, 413 (body middleware), 429, 500, 502/503, and 504. Rate limits are configurable and include rate headers/`Retry-After`. Current counters are process-local and are not a shared distributed limiter; they are only a safeguard for a single process. Production horizontal scaling needs a shared Redis/rate-limiting store, trusted proxy/IP configuration, monitoring and provider-level spend quotas. CORS is public `*` without credentialed access; it is not auth or abuse protection.

## Local development

Requirements for the repository build/test toolchain: Node.js >=20, npm, Python >=3.9. The published JavaScript SDK's runtime target remains Node.js >=18.

```sh
cp .env.example .env
npm install
npm run dev                 # API on 0.0.0.0:3000
npm run dev:web             # Vite developer portal
```

Put provider/storage credentials in server environment only. The text/chat/vision/image routes use an OpenAI-compatible provider endpoint. Configure `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and capability model names in `.env` or your deployment environment. A model is not available until both provider credential and capability model are configured. The sample values in `.env.example` are blank where secrets/models belong.

The image store uses S3 when `OPENMUSE_S3_BUCKET` is configured, with AWS SDK credentials/role provided out-of-band and S3 object retention documented/configured. Without this configuration it falls back to memory and images are lost on process restart. Set object lifecycle rules for both `openmuse-images/` and `openmuse-image-metadata/` to match `OPENMUSE_IMAGE_RETENTION_DAYS`; application code enforces retention on retrieval. The S3 adapter does not provision buckets or configure lifecycle rules.

## Build and test

```sh
npm run typecheck
npm test
npm run build
npm run validate:openapi
python -m venv .venv
.venv/bin/python -m pip install -e ./packages/python pytest build
.venv/bin/python -m pytest packages/python/tests
.venv/bin/python -m build packages/python
```

Package releases (after ownership, registry access, CI/review): `npm publish --access public` from `packages/javascript`; `python -m build packages/python && python -m twine upload packages/python/dist/*`. No npm or PyPI publication has been performed.

## Deployment

The API entrypoint is `src/backend/server.ts` and binds `0.0.0.0`, reading `PORT` (default 3000). `npm run build` emits the backend at `dist/backend` and the developer portal at `dist/web`; the Node server serves the built portal and API from one origin. Existing AppDeploy deployment should be retained. The checkout contains no AppDeploy manifest, deployment CLI configuration, or connected deploy tool, so this change does not claim a deployment. Configure provider credentials, models, S3 and the environment variables in `.env.example` in the deployment control plane. Run `npm run build` then `npm start`. Ensure the platform supports streaming passthrough and no response buffering. Run `npm run build` before deployment and smoke-test all endpoint groups after deployment.

The developer site is a Vite static app (`npm run build:web`); the interactive explorer sends real browser requests to the configured public API base URL. It does not substitute mock outputs. Since current deployed behavior is not reachable/verified from this code-only task, playground calls may truthfully show network/provider configuration errors.

## Known limitations

- Repository at task start had no backend, deployment manifest, frontend, or tests; this implementation is new. Existing production behavior was not inspectable from the clone.
- Provider and object-storage credentials were not provided. Real inference, image generation, vision, provider-native incremental streaming, and durable S3 persistence were not exercised here; endpoints respond honestly when models are unavailable.
- Local rate limiting is per-process. Use a shared store and platform-level spend/concurrency quotas for scaled production.
- S3 storage is optional. Memory fallback is volatile; durable storage requires bucket credentials/permissions and an operator-managed lifecycle rule.
- SDKs are prepared in the repository but not published; registry availability and publication authorization must be checked at release.
- No production endpoint, PR, merge, or deployment is claimed unless separately verified in the final task report.

## Contributing and license

See `CONTRIBUTING.md`. SDK and repository source use MIT licensing (`LICENSE`). Changes to response shapes should remain backward-compatible within API v1 and update OpenAPI plus both SDKs.
