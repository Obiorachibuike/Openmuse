# Chat streaming

`POST /api/v1/chat/stream` uses provider-native OpenAI-compatible chat-completions streaming. The service reads provider SSE incrementally and emits OpenMuse SSE events; it does not first buffer a whole response. Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.

Events have `event: <name>` and JSON `data:`. Event names: `message_start` (`{id}`), `content_delta` (`{text}`), `message_end` (`{finish_reason}`), and `error` (`{message}`). The stream ends with `data: [DONE]`. Provider must support native stream deltas, and the operator must verify that capability and set `OPENMUSE_TEXT_STREAMING_ENABLED=true`. Until enabled, `GET /models` does not claim streaming and the stream endpoint returns 503. Client disconnect cancels the upstream response. Deployment proxies must not buffer SSE; this must be verified in the selected hosting platform.

JavaScript: `for await (const event of client.chat.stream({messages:[{role:'user',content:'Hi'}]})) ...`. Python: iterate `client.chat.stream(...)`. Both parse event boundaries across arbitrary transport chunks and release the response when iteration closes.
