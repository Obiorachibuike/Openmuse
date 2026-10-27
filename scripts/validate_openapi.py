import json
from pathlib import Path

doc = json.loads(Path('openapi/openapi.json').read_text())
assert doc['openapi'] == '3.1.0'
required = {'/health', '/models', '/text', '/chat', '/chat/stream', '/images/generations', '/images/{id}', '/vision', '/openapi.json'}
assert required <= doc['paths'].keys()
print(f"OpenAPI {doc['openapi']} valid JSON; {len(doc['paths'])} paths present")
