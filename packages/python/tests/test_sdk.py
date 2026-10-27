import httpx
import pytest
from openmuse import OpenMuse, OpenMuseAPIError, OpenMuseRateLimitError


def client_for(handler):
    return OpenMuse(base_url="https://host.example/custom/api/v1", transport=httpx.MockTransport(handler))


def test_default_calls_response_attribute_access_and_custom_base_url():
    def handler(request):
        assert str(request.url) == "https://host.example/custom/api/v1/text"
        assert request.read() == b'{"prompt":"hello"}'
        return httpx.Response(200, json={"output":{"text":"hi"}})
    with client_for(handler) as client:
        assert client.text.generate("hello").output.text == "hi"


def test_error_exception_mapping():
    client = OpenMuse(transport=httpx.MockTransport(lambda req: httpx.Response(429, json={"error":{"message":"slow","code":"RATE_LIMIT_EXCEEDED","request_id":"r1"}}, headers={"retry-after":"4"})))
    with pytest.raises(OpenMuseRateLimitError) as err: client.text.generate("hello")
    assert err.value.status == 429 and err.value.retry_after == 4 and err.value.request_id == "r1"
    client.close()


def test_chat_stream_incremental_sse_and_response_cleanup():
    payload = (b'event: message_start\ndata: {"id":"x"}\n\n'
               b'event: content_delta\ndata: {"text":"hello"}\n\n'
               b'event: message_end\ndata: {"finish_reason":"stop"}\n\n'
               b'data: [DONE]\n\n')
    client = OpenMuse(transport=httpx.MockTransport(lambda req: httpx.Response(200, headers={"content-type":"text/event-stream"}, content=payload)))
    events = list(client.chat.stream([{"role":"user","content":"hi"}]))
    assert [e.type for e in events] == ["message_start", "content_delta", "message_end"]
    assert events[1].text == "hello"
    client.close()


def test_image_retrieve_validates_id_and_returns_bytes():
    client = OpenMuse(transport=httpx.MockTransport(lambda req: httpx.Response(200, content=b"png")))
    assert client.images.retrieve("img_" + "a"*32).content == b"png"
    with pytest.raises(ValueError): client.images.retrieve("../secret")
    client.close()


def test_stream_http_error():
    client = OpenMuse(transport=httpx.MockTransport(lambda req: httpx.Response(503, json={"error":{"message":"offline"}})))
    with pytest.raises(OpenMuseAPIError): list(client.chat.stream([{"role":"user","content":"hi"}]))
    client.close()


def test_generation_vision_models_health_and_timeout():
    def handler(request):
        if request.url.path.endswith("/images/generations"):
            assert request.read() == b'{"prompt":"a lake"}'
            return httpx.Response(201, json={"data":[{"id":"img_a","url":"/image"}]})
        if request.url.path.endswith("/vision"):
            body = request.read().decode()
            assert '"image_url":"https://example.org/a.png"' in body
            return httpx.Response(200, json={"output":{"text":"a lake"}})
        if request.url.path.endswith("/models"): return httpx.Response(200, json={"object":"list","data":[]})
        return httpx.Response(200, json={"status":"ok","service":"OpenMuse","version":"1","timestamp":"now"})
    with client_for(handler) as client:
        assert client.images.generate("a lake").data[0].id == "img_a"
        assert client.vision.analyze(image_url="https://example.org/a.png", prompt="describe").output.text == "a lake"
        assert client.models.list().data == []
        assert client.health.check().status == "ok"
    timeout_client = OpenMuse(transport=httpx.MockTransport(lambda req: (_ for _ in ()).throw(httpx.ReadTimeout("timeout"))))
    from openmuse import OpenMuseTimeoutError
    with pytest.raises(OpenMuseTimeoutError): timeout_client.text.generate("timeout")
    timeout_client.close()
