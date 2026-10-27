# @openmuse-ai/sdk

Official TypeScript-first JavaScript client for OpenMuse API v1. The public API currently needs no client API key. Public access is rate-limited and depends on operator capacity; it is not an unlimited inference service.

## Install (after publication)

```sh
npm install @openmuse-ai/sdk
```

Until the package is published, from an OpenMuse checkout: `npm install ./packages/javascript` (or `npm pack --workspace=@openmuse-ai/sdk` and install the resulting tarball). Package name availability was checked in the npm registry on 2026-10-27 and returned 404. This repository does not claim the name or publication.

## Usage

```ts
import { OpenMuse } from '@openmuse-ai/sdk';
const ai = new OpenMuse(); // production URL, no API key
const result = await ai.text.generate({ prompt: 'Explain REST APIs simply.' });
console.log(result.output.text);
```

Use a local or self-hosted API with `new OpenMuse({ baseURL: 'http://localhost:3000/api/v1', timeout: 30_000 })`. Supply `fetch` to customize the transport. All operations that make a request accept an optional second `{ signal: AbortSignal }` argument. Example: `ai.chat.create({ messages: [...] }, { signal: controller.signal })`.

```ts
const answer = await ai.chat.create({ messages: [{ role: 'user', content: 'What is TypeScript?' }] });
for await (const event of ai.chat.stream({ messages: [{ role: 'user', content: 'Explain neural networks.' }] })) {
  if (event.type === 'content_delta') process.stdout.write(event.text);
}
const image = await ai.images.generate({ prompt: 'A tranquil futuristic city' });
const imageResponse = await ai.images.retrieve(image.data[0]!.id); // fetch Response; read via .blob() / .arrayBuffer()
const analysis = await ai.vision.analyze({ image_url: 'https://example.org/image.jpg', prompt: 'Describe it.' });
const models = await ai.models.list();
const health = await ai.health.check();
```

Errors: `OpenMuseAPIError` retains status, code, requestId and retryAfter; `OpenMuseRateLimitError`, `OpenMuseTimeoutError`, and `OpenMuseConnectionError` provide specializations. Generation operations are not automatically retried, avoiding duplicate inference charges. Browser use is supported through standard Fetch; public CORS is enabled by the service.

Node.js >=18. SDK package release uses `npm publish --access public` from this directory after registry authorization and review. API compatibility: `/api/v1`.
