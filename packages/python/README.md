# openmuse-ai

Official synchronous Python SDK for OpenMuse API v1. No client API key is required for public endpoints. Requests are rate-limited and subject to operator capacity; usage is not unlimited.

## Install (after publication)

```sh
pip install openmuse-ai
```

Until publication, install from a checkout: `python -m pip install ./packages/python` (or build a wheel with `python -m build packages/python`). The PyPI package name is prepared in metadata; publication has not been performed.

## Examples

```python
from openmuse import OpenMuse

with OpenMuse() as client:
    result = client.text.generate(prompt="Explain APIs to a beginner.")
    print(result.output.text)

    response = client.chat.create(messages=[{"role": "user", "content": "What is Python?"}])
    print(response.choices[0].message.content)

    for event in client.chat.stream(messages=[{"role": "user", "content": "Explain databases."}]):
        if event.type == "content_delta":
            print(event.text, end="", flush=True)

    image = client.images.generate(prompt="A peaceful futuristic city.")
    print(image.data[0].url)
    image_bytes = client.images.retrieve(image.data[0].id).content

    vision = client.vision.analyze(image_url="https://example.org/image.jpg", prompt="Describe it.")
    print(vision.output.text)
    print(client.models.list().data)
    print(client.health.check().status)
```

Configure self-hosted/local URL with `OpenMuse(base_url="http://localhost:3000/api/v1", timeout=30.0)`. Custom `httpx.BaseTransport` and an `httpx.Client` can be injected for testing/custom transport. The client is a context manager and can also be explicitly closed. Streaming is synchronous SSE and releases its response when iteration ends or is closed. Errors expose `.status`, `.code`, `.request_id`, and `.retry_after`; generation requests are never automatically retried.

Requires Python >=3.9. Registry package name availability/publication should be verified with the PyPI account before release.
