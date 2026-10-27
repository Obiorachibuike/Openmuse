# API and SDK examples

The package examples below use the local workspace install until publication (`npm install ./packages/javascript`, `python -m pip install ./packages/python`). Public API calls require no client key. Configure provider models on the server; otherwise inference endpoints return `503 MODEL_UNAVAILABLE`.

Base URL: `https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1`. For the cURL snippets set `BASE=https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1` in your shell.

## Health and models

```sh
curl https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/health
curl https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/models
```

```ts
const health = await muse.health.check();
const models = await muse.models.list();
```

```python
health = client.health.check()
models = client.models.list()
```

## Text

```sh
curl -X POST "$BASE/text" -H 'Content-Type: application/json' -d '{"prompt":"Explain REST APIs simply."}'
```

```ts
const result = await muse.text.generate({ prompt: 'Explain REST APIs simply.' });
console.log(result.output.text);
```

```python
result = client.text.generate(prompt="Explain REST APIs simply.")
print(result.output.text)
```

## Chat

```sh
curl -X POST "$BASE/chat" -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"What is TypeScript?"}]}'
```

```ts
const response = await muse.chat.create({ messages: [{ role: 'user', content: 'What is TypeScript?' }] });
console.log(response.choices[0]?.message.content);
```

```python
response = client.chat.create(messages=[{"role": "user", "content": "What is TypeScript?"}])
print(response.choices[0].message.content)
```

## Genuine incremental chat stream

```sh
curl -N -X POST "$BASE/chat/stream" -H 'Content-Type: application/json' -H 'Accept: text/event-stream' -d '{"messages":[{"role":"user","content":"Explain neural networks."}]}'
```

```ts
for await (const event of muse.chat.stream({ messages: [{ role: 'user', content: 'Explain neural networks.' }] })) {
  if (event.type === 'content_delta') process.stdout.write(event.text);
}
```

```python
for event in client.chat.stream(messages=[{"role": "user", "content": "Explain neural networks."}]):
    if event.type == "content_delta": print(event.text, end="", flush=True)
```

Requires native provider SSE support plus `OPENMUSE_TEXT_STREAMING_ENABLED=true`; otherwise 503 is returned and the model's `streaming` property remains false.

## Image generation and retrieval

```sh
curl -X POST "$BASE/images/generations" -H 'Content-Type: application/json' -d '{"prompt":"A minimal futuristic city skyline."}'
# Use data[0].id from the response:
curl "$BASE/images/img_REPLACE_WITH_RETURNED_ID" --output image.png
```

```ts
const generated = await muse.images.generate({ prompt: 'A minimal futuristic city skyline.' });
const imageResponse = await muse.images.retrieve(generated.data[0]!.id);
const imageBytes = await imageResponse.arrayBuffer();
```

```python
generated = client.images.generate(prompt="A minimal futuristic city skyline.")
image_bytes = client.images.retrieve(generated.data[0].id).content
```

Image IDs are opaque UUID-based identifiers. Retrieval uses the API proxy path and the configured retention period. Durable retrieval across restarts requires S3 configuration.

## Vision

Provide a public image URL that resolves to public IP addresses and serves PNG, JPEG, WebP, or GIF, or supply a base64 data URL (`image_data`) up to 5 MiB.

```sh
curl -X POST "$BASE/vision" -H 'Content-Type: application/json' -d '{"image_url":"https://your-public-image-host.example/photo.jpg","prompt":"Describe the visible objects."}'
```

```ts
const analysis = await muse.vision.analyze({ image_url: 'https://your-public-image-host.example/photo.jpg', prompt: 'Describe the visible objects.' });
console.log(analysis.output.text);
```

```python
analysis = client.vision.analyze(image_url="https://your-public-image-host.example/photo.jpg", prompt="Describe the visible objects.")
print(analysis.output.text)
```

## Errors

```ts
try { await muse.text.generate({ prompt: 'Hello' }); }
catch (error) { if (error instanceof OpenMuseAPIError) console.error(error.status, error.code, error.requestId); }
```

```python
from openmuse import OpenMuseAPIError
try: client.text.generate(prompt="Hello")
except OpenMuseAPIError as exc: print(exc.status, exc.code, exc.request_id)
```
