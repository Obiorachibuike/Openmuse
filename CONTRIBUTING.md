# Contributing

1. Install Node.js 18+, npm and Python 3.9+; run `npm install` and install `httpx`/`pytest` for the Python SDK.
2. Keep API changes compatible within `/api/v1`; update `openapi/openapi.json`, runtime schemas/validation, SDK types, docs and tests together.
3. Provider credentials must remain server-side. Do not add API keys to the frontend or SDK defaults. Do not log prompts/image bytes.
4. Use mocked providers/transports for deterministic tests. Avoid CI tests that incur inference costs.
5. Run `npm run typecheck && npm test && npm run build && npm run validate:openapi && python -m pytest packages/python/tests`.
6. Do not publish packages or deploy without explicit credentials/authorization and successful review. Report limitations accurately.

All contributions are subject to the MIT license.
