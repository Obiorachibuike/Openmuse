# Quickstart

API base: `https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1`. No API key is required for public endpoints. Public access is rate-limited and capacity-dependent, not an unlimited service.

## REST

```sh
curl -X POST "$OPENMUSE_API_BASE_URL/text" -H 'Content-Type: application/json' -d '{"prompt":"Explain HTTP."}'
```

Set `OPENMUSE_API_BASE_URL` to the base above. If no provider model is configured, expect a structured 503 rather than sample output.

## TypeScript

After locally building the workspace: `npm install ./packages/javascript`.

```ts
import { OpenMuse } from '@openmuse-ai/sdk';
const client = new OpenMuse();
const result = await client.text.generate({ prompt: 'Explain HTTP.' });
console.log(result.output.text);
```

## Python

`python -m pip install ./packages/python`

```python
from openmuse import OpenMuse
with OpenMuse() as client:
    print(client.text.generate(prompt="Explain HTTP.").output.text)
```

Package publication to npm/PyPI is not completed. See the repository root README for the full feature examples and setup.
