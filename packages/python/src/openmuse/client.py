from __future__ import annotations
import json
from typing import Any, Iterator, Mapping, Optional
from urllib.parse import quote
import httpx
from .errors import OpenMuseAPIError, OpenMuseConnectionError, OpenMuseRateLimitError, OpenMuseTimeoutError

DEFAULT_BASE = "https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1"

class ResponseData(dict):
    """Dictionary response with attribute access and recursively wrapped children."""
    def __getattr__(self, name: str) -> Any:
        try: return self[name]
        except KeyError as exc: raise AttributeError(name) from exc

def _wrap(value: Any) -> Any:
    if isinstance(value, dict): return ResponseData({key: _wrap(item) for key, item in value.items()})
    if isinstance(value, list): return [_wrap(item) for item in value]
    return value

class _Resource:
    def __init__(self, client: "OpenMuse"): self._client = client

class TextResource(_Resource):
    def generate(self, prompt: str, *, model: Optional[str] = None, max_tokens: Optional[int] = None,
                 temperature: Optional[float] = None, timeout: Optional[float] = None) -> ResponseData:
        return self._client._request("POST", "/text", {k:v for k,v in {"prompt":prompt,"model":model,"max_tokens":max_tokens,"temperature":temperature}.items() if v is not None}, timeout=timeout)

class ChatResource(_Resource):
    def create(self, messages: list[Mapping[str, Any]], *, model: Optional[str] = None, max_tokens: Optional[int] = None,
               temperature: Optional[float] = None, timeout: Optional[float] = None) -> ResponseData:
        body = {k:v for k,v in {"messages":messages,"model":model,"max_tokens":max_tokens,"temperature":temperature}.items() if v is not None}
        return self._client._request("POST", "/chat", body, timeout=timeout)

    def stream(self, messages: list[Mapping[str, Any]], *, model: Optional[str] = None, max_tokens: Optional[int] = None,
               temperature: Optional[float] = None, timeout: Optional[float] = None) -> Iterator[ResponseData]:
        body = {k:v for k,v in {"messages":messages,"model":model,"max_tokens":max_tokens,"temperature":temperature}.items() if v is not None}
        yield from self._client._stream("/chat/stream", body, timeout=timeout)

class ImageResource(_Resource):
    def generate(self, prompt: str, *, model: Optional[str] = None, size: Optional[str] = None, timeout: Optional[float] = None) -> ResponseData:
        return self._client._request("POST", "/images/generations", {k:v for k,v in {"prompt":prompt,"model":model,"size":size}.items() if v is not None}, timeout=timeout)
    def retrieve(self, image_id: str, *, timeout: Optional[float] = None) -> httpx.Response:
        if not __import__('re').fullmatch(r"img_[a-f0-9]{32}", image_id): raise ValueError("Invalid OpenMuse image id")
        return self._client._request("GET", "/images/" + quote(image_id, safe=""), timeout=timeout, raw=True)

class VisionResource(_Resource):
    def analyze(self, *, prompt: str, image_url: Optional[str] = None, image_data: Optional[str] = None,
                model: Optional[str] = None, timeout: Optional[float] = None) -> ResponseData:
        body = {k:v for k,v in {"prompt":prompt,"image_url":image_url,"image_data":image_data,"model":model}.items() if v is not None}
        return self._client._request("POST", "/vision", body, timeout=timeout)

class OpenMuse:
    """Synchronous OpenMuse API client. No API key is required for public endpoints."""
    def __init__(self, *, base_url: str = DEFAULT_BASE, timeout: float = 30.0,
                 transport: Optional[httpx.BaseTransport] = None, client: Optional[httpx.Client] = None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = client or httpx.Client(base_url=self.base_url + "/", timeout=timeout, transport=transport, follow_redirects=False)
        self.text = TextResource(self); self.chat = ChatResource(self); self.images = ImageResource(self); self.vision = VisionResource(self)
        self.models = _GetResource(self, "/models"); self.health = _GetResource(self, "/health")

    def _translate(self, exc: Exception) -> OpenMuseError:
        if isinstance(exc, httpx.TimeoutException): return OpenMuseTimeoutError("OpenMuse request timed out")
        return OpenMuseConnectionError("Could not connect to OpenMuse")

    def _request(self, method: str, path: str, body: Optional[dict] = None, *, timeout: Optional[float] = None, raw: bool = False) -> Any:
        try:
            response = self._client.request(method, path.lstrip("/"), json=body, timeout=timeout or self.timeout)
        except (httpx.TimeoutException, httpx.TransportError) as exc: raise self._translate(exc) from exc
        if not response.is_success: raise self._error(response)
        return response if raw else _wrap(response.json())

    def _error(self, response: httpx.Response) -> OpenMuseAPIError:
        try: err = response.json().get("error", {})
        except (ValueError, AttributeError): err = {}
        retry = response.headers.get("retry-after") or err.get("retry_after")
        cls = OpenMuseRateLimitError if response.status_code == 429 else OpenMuseAPIError
        try: retry_after = int(retry) if retry is not None else None
        except (ValueError, TypeError): retry_after = None
        return cls(err.get("message", f"OpenMuse request failed with HTTP {response.status_code}"), response.status_code,
                   err.get("code"), err.get("request_id") or response.headers.get("x-request-id"), retry_after, err.get("type"))

    def _stream(self, path: str, body: dict, *, timeout: Optional[float] = None) -> Iterator[ResponseData]:
        try:
            with self._client.stream("POST", path.lstrip("/"), json=body, timeout=timeout or self.timeout, headers={"accept":"text/event-stream"}) as response:
                if not response.is_success: raise self._error(response)
                if "text/event-stream" not in response.headers.get("content-type", ""): raise OpenMuseAPIError("OpenMuse returned an invalid stream response", response.status_code)
                event_name = "message"; data: list[str] = []
                for line in response.iter_lines():
                    if line == "":
                        if data:
                            payload = "\n".join(data)
                            if payload == "[DONE]": return
                            try: parsed = json.loads(payload)
                            except ValueError as exc: raise OpenMuseAPIError("OpenMuse returned malformed SSE data", response.status_code) from exc
                            if event_name in {"message_start", "content_delta", "message_end", "error"}:
                                yield _wrap({"type":event_name, **parsed})
                        event_name = "message"; data = []
                    elif line.startswith("event:"): event_name = line[6:].strip()
                    elif line.startswith("data:"): data.append(line[5:].lstrip())
        except OpenMuseAPIError: raise
        except (httpx.TimeoutException, httpx.TransportError) as exc: raise self._translate(exc) from exc

    def close(self) -> None: self._client.close()
    def __enter__(self) -> "OpenMuse": return self
    def __exit__(self, *_: object) -> None: self.close()

class _GetResource(_Resource):
    def __init__(self, client: OpenMuse, path: str): super().__init__(client); self.path = path
    def check(self) -> ResponseData: return self._client._request("GET", self.path)
    def list(self) -> ResponseData: return self.check()
