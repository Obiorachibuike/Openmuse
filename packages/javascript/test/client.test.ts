import { describe, it, expect, vi } from 'vitest';
import { OpenMuse, OpenMuseAPIError, OpenMuseRateLimitError } from '../src/index.js';

describe('OpenMuse SDK', () => {
  it('defaults to the public API, serializes requests, and parses responses', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1/text');
      expect(JSON.parse(String(init?.body))).toEqual({ prompt: 'hello' });
      return Response.json({ output: { text: 'hi' } });
    });
    const client = new OpenMuse({ fetch: fetcher as typeof fetch });
    expect((await client.text.generate({ prompt: 'hello' })).output.text).toBe('hi');
  });
  it('maps API and rate limit errors', async () => {
    const c = new OpenMuse({ fetch: async () => Response.json({ error: { message: 'slow down', code: 'RATE_LIMIT_EXCEEDED', request_id: 'req1' } }, { status: 429, headers: { 'retry-after': '5' } }) });
    await expect(c.text.generate({ prompt: 'hello' })).rejects.toMatchObject({ name: 'OpenMuseRateLimitError', status: 429, retryAfter: 5, requestId: 'req1' });
    expect(OpenMuseAPIError).toBeTruthy(); expect(OpenMuseRateLimitError).toBeTruthy();
  });
  it('parses events split across network chunks, including multiple frames', async () => {
    const frames = ['event: message_start\r\ndata: {"id":\r\ndata: "c1"}\r\n\r\n', 'event: content_delta\r\ndata: {"text":"A"}\r\n\r\n', 'event: content_delta\r\ndata: {"text":"B"}\r\n\r\n', 'data: [DONE]\r\n\r\n'];
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { const all = encoder.encode(frames.join('')); const cut = all.indexOf(13) + 1; controller.enqueue(all.slice(0, cut)); controller.enqueue(all.slice(cut, 64)); controller.enqueue(all.slice(64)); controller.close(); } });
    const client = new OpenMuse({ fetch: async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }) });
    const events = []; for await (const event of client.chat.stream({ messages: [{ role: 'user', content: 'x' }] })) events.push(event);
    expect(events.map(e => e.type)).toEqual(['message_start', 'content_delta', 'content_delta']);
    expect(events[1]).toMatchObject({ text: 'A' }); expect(events[2]).toMatchObject({ text: 'B' });
  });
  it('uses a custom base URL', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request) => Response.json({ status: 'ok' }));
    const c = new OpenMuse({ baseURL: 'http://localhost:3000/api/v1/', fetch: fetcher as typeof fetch });
    await c.health.check(); expect(String(fetcher.mock.calls[0]?.[0])).toBe('http://localhost:3000/api/v1/health');
  });
  it('covers image generation/retrieval, vision, model listing, and health', async () => {
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/images/generations')) return Response.json({ id: 'img_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', object: 'image.generation', status: 'completed', created: 1, model: 'm', data: [{ id: 'img_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', url: '/api/v1/images/img_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', width: 1024, height: 1024 }] }, { status: 201 });
      if (url.includes('/images/img_')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
      if (url.endsWith('/vision')) return Response.json({ output: { text: 'a cat' } });
      if (url.endsWith('/models')) return Response.json({ object: 'list', data: [] });
      return Response.json({ status: 'ok', service: 'OpenMuse', version: '1.0.0', timestamp: '2026-01-01T00:00:00.000Z' });
    };
    const c = new OpenMuse({ fetch: fetcher as typeof fetch });
    const image = await c.images.generate({ prompt: 'a landscape' });
    expect((await c.images.retrieve(image.data[0]!.id)).status).toBe(200);
    expect((await c.vision.analyze({ image_url: 'https://example.org/a.png', prompt: 'describe' })).output.text).toBe('a cat');
    expect((await c.models.list()).data).toEqual([]); expect((await c.health.check()).status).toBe('ok');
  });
  it('distinguishes request timeouts from caller cancellation', async () => {
    const pending = async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    const timed = new OpenMuse({ timeout: 10, fetch: pending as typeof fetch });
    await expect(timed.text.generate({ prompt: 'wait' })).rejects.toMatchObject({ name: 'OpenMuseTimeoutError' });
    const caller = new AbortController(); const client = new OpenMuse({ timeout: 5_000, fetch: pending as typeof fetch });
    const request = client.text.generate({ prompt: 'cancel' }, { signal: caller.signal }); caller.abort();
    await expect(request).rejects.toThrow('aborted');
  });
});
