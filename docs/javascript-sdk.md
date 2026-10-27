# JavaScript / TypeScript SDK

Package: `@openmuse-ai/sdk` version 1.0.0, API `/api/v1`. The package name returned an npm 404 on 2026-10-27, but no publication/ownership is claimed. Build: `npm run build:sdk`; local install: `npm install ./packages/javascript`.

```ts
import { OpenMuse, OpenMuseAPIError, OpenMuseRateLimitError } from '@openmuse-ai/sdk';
const client = new OpenMuse({ baseURL: 'http://localhost:3000/api/v1', timeout: 30_000 });
const result = await client.text.generate({ prompt: 'Hello' });
const chat = await client.chat.create({ messages: [{ role: 'user', content: 'Hi' }] });
for await (const event of client.chat.stream({ messages: [{ role: 'user', content: 'Stream this' }] })) {
  if (event.type === 'content_delta') process.stdout.write(event.text);
}
const image = await client.images.generate({ prompt: 'A lake' });
const response = await client.images.retrieve(image.data[0]!.id);
const vision = await client.vision.analyze({ image_url: 'https://example.org/photo.jpg', prompt: 'Describe it' });
const models = await client.models.list(); const health = await client.health.check();
```

Each request supports `{signal}` as an optional second parameter. Typed errors expose status/code/request ID/retry advice. Requests are not automatically retried. No browser secret is required.
