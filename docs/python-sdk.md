# Python SDK

Package `openmuse-ai`, version 1.0.0, Python 3.9+, API `/api/v1`. PyPI lookup on 2026-10-27 returned no published matching distribution; package remains unpublished. Local: `python -m pip install ./packages/python`.

```python
from openmuse import OpenMuse, OpenMuseAPIError
with OpenMuse(base_url="http://localhost:3000/api/v1", timeout=30) as client:
    result = client.text.generate(prompt="Hello")
    chat = client.chat.create(messages=[{"role":"user","content":"Hi"}])
    for event in client.chat.stream(messages=[{"role":"user","content":"Stream this"}]):
        if event.type == "content_delta": print(event.text, end="", flush=True)
    image = client.images.generate(prompt="A lake")
    data = client.images.retrieve(image.data[0].id).content
    vision = client.vision.analyze(image_url="https://example.org/photo.jpg", prompt="Describe it")
    models = client.models.list(); health = client.health.check()
```

Client is synchronous and context-managed; inject `httpx.BaseTransport` for tests. Errors expose status/code/request ID/retry advice. No automatic generation retries.
