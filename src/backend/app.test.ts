import { describe, it, expect, vi } from 'vitest';
import { app } from './app.js';

describe('OpenMuse HTTP API', () => {
  it('serves health and request ids', async () => {
    const res = await app.request('/api/v1/health'); const data = await res.json();
    expect(res.status).toBe(200); expect(data).toMatchObject({ status: 'ok', service: 'OpenMuse' }); expect(data.timestamp).toBeTruthy(); expect(res.headers.get('x-request-id')).toMatch(/^req_/);
  });
  it('returns only actually configured models (none without credentials)', async () => {
    const res = await app.request('/api/v1/models'); expect(res.status).toBe(200); expect(await res.json()).toEqual({ object: 'list', data: [] });
  });
  it('validates generation input and handles missing provider configuration honestly', async () => {
    const empty = await app.request('/api/v1/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: ' ' }) });
    expect(empty.status).toBe(400); expect((await empty.json()).error.code).toBe('INVALID_PROMPT');
    const noProvider = await app.request('/api/v1/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'Hello' }) });
    expect(noProvider.status).toBe(503); expect((await noProvider.json()).error.code).toBe('MODEL_UNAVAILABLE');
    const badModel = await app.request('/api/v1/text', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'Hello', model: 'not-configured' }) });
    expect(badModel.status).toBe(400); expect((await badModel.json()).error.code).toBe('INVALID_MODEL');
  });
  it('returns consistent not found errors and permissive non-credentialed CORS', async () => {
    const missing = await app.request('/api/v1/nope'); expect(missing.status).toBe(404); expect((await missing.json()).error.request_id).toMatch(/^req_/);
    const options = await app.request('/api/v1/health', { method: 'OPTIONS', headers: { origin: 'https://example.org', 'access-control-request-method': 'GET' } }); expect(options.headers.get('access-control-allow-origin')).toBe('*');
  });
  it('serves the checked-in OpenAPI contract', async () => {
    const res = await app.request('/api/v1/openapi.json'); expect(res.status).toBe(200); expect((await res.json()).openapi).toBe('3.1.0');
  });
  it('rejects malformed image ids safely', async () => {
    const res = await app.request('/api/v1/images/../../etc/passwd'); expect([404, 400]).toContain(res.status);
  });
  it('rejects private-network vision URLs before provider dispatch', async () => {
    const res = await app.request('/api/v1/vision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image_url: 'http://127.0.0.1/secret', prompt: 'Describe it' }) });
    expect(res.status).toBe(400); expect((await res.json()).error.code).toBe('INVALID_IMAGE');
  });
  it('uses a consistent 413 error envelope for oversized request bodies', async () => {
    const req = new Request('http://localhost/api/v1/text', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '9000000' }, body: 'x' });
    const res = await app.fetch(req); expect(res.status).toBe(413); expect((await res.json()).error.code).toBe('REQUEST_TOO_LARGE');
  });
  it('forwards provider stream deltas incrementally rather than buffering the full answer', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'unit-test-secret'); vi.stubEnv('OPENMUSE_TEXT_MODEL', 'test-model'); vi.stubEnv('OPENMUSE_TEXT_STREAMING_ENABLED', 'true');
    vi.resetModules();
    const encoder = new TextEncoder();
    const upstreamBody = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"first"}}]}\n\n'));
      setTimeout(() => { controller.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')); controller.close(); }, 120);
    } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(upstreamBody, { status: 200, headers: { 'content-type': 'text/event-stream' } })));
    const { app: configuredApp } = await import('./app.js');
    const response = await configuredApp.request('/api/v1/chat/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'stream test' }] }) });
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader(); const first = await reader.read(); const firstText = new TextDecoder().decode(first.value);
    expect(firstText).toContain('event: message_start');
    const started = Date.now(); const second = await reader.read(); const secondText = new TextDecoder().decode(second.value);
    expect(secondText).toContain('event: content_delta'); expect(Date.now() - started).toBeLessThan(100);
    let rest = ''; while (true) { const next = await reader.read(); if (next.done) break; rest += new TextDecoder().decode(next.value); }
    expect(rest).toContain('data: [DONE]');
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules();
  });
});
