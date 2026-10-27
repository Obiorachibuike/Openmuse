import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import { Agent } from 'undici';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config.js';
import { analyzeImage, createChat, generateImage, generateText, ProviderError, streamChat } from './provider.js';
import { imageStorageMode, imageStore, StorageError } from './storage.js';

export const app = new Hono<{ Variables: { requestId: string } }>();
const limits = new Map<string, { start: number; count: number }>();
let activeGenerations = 0;
const modelRecords = () => {
  const grouped = new Map<string, { id: string; name: string; provider: string; availability: boolean; capabilities: string[]; streaming: boolean; vision: boolean; image_generation: boolean; parameter_limits: { max_tokens: { min: number; max: number }; temperature: { min: number; max: number } } }>();
  const add = (id: string | undefined, capability: string, streaming = false) => {
    if (!id || !config.providerKey) return;
    const item = grouped.get(id) ?? { id, name: id, provider: 'openai-compatible', availability: true, capabilities: [], streaming: false, vision: false, image_generation: false, parameter_limits: { max_tokens: { min: 1, max: config.maxOutputTokens }, temperature: { min: 0, max: 2 } } };
    item.capabilities.push(capability); item.streaming ||= streaming; item.vision ||= capability === 'vision'; item.image_generation ||= capability === 'image_generation'; grouped.set(id, item);
  };
  add(config.textModel, 'text'); add(config.textModel, 'chat', config.textStreamingEnabled); add(config.visionModel, 'vision'); add(config.imageModel, 'image_generation');
  return [...grouped.values()].map(m => ({ ...m, object: 'model' }));
};
function error(c: any, status: number, type: string, message: string, code: string, extra: Record<string, unknown> = {}) {
  return c.json({ error: { type, message, code, request_id: c.get('requestId'), ...extra } }, status);
}
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id');
  c.set('requestId', reqId && /^[a-zA-Z0-9_-]{1,100}$/.test(reqId) ? reqId : `req_${randomUUID().replaceAll('-', '')}`);
  c.header('X-Request-Id', c.get('requestId'));
  c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'no-referrer');
  await next();
});
app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'X-Request-Id'], exposeHeaders: ['X-Request-Id', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'], maxAge: 86400 }));
app.use('/api/v1/*', bodyLimit({ maxSize: config.maxBodyBytes, onError: c => error(c, 413, 'request_too_large_error', 'Request payload exceeds the configured size limit.', 'REQUEST_TOO_LARGE') }));
app.onError((err, c) => {
  if (err instanceof StorageError) return error(c, 503, 'storage_unavailable_error', 'Image storage is temporarily unavailable.', 'STORAGE_UNAVAILABLE');
  if (err instanceof ProviderError) return error(c, err.status, err.status === 503 ? 'service_unavailable_error' : err.status === 504 ? 'timeout_error' : 'upstream_error', err.message, err.status === 503 ? 'PROVIDER_UNAVAILABLE' : err.status === 504 ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR');
  console.error(JSON.stringify({ event: 'request_error', request_id: c.get('requestId'), error_name: err.name ?? 'Error' }));
  return error(c, 500, 'internal_error', 'An unexpected error occurred.', 'INTERNAL_ERROR');
});
function rateLimit(expensive = false) {
  return async (c: any, next: () => Promise<void>) => {
    // Use the transport peer address; forwarded headers are deliberately not trusted here.
    const socketIp = c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
    const key = `${socketIp}:${expensive ? 'expensive' : 'standard'}`;
    const max = expensive ? config.expensiveRateMax : config.rateMax; const now = Date.now();
    let record = limits.get(key);
    if (!record || now - record.start >= config.rateWindowMs) record = { start: now, count: 0 };
    record.count++; limits.set(key, record);
    if (limits.size > 10_000) for (const [k, v] of limits) if (now - v.start >= config.rateWindowMs) limits.delete(k);
    c.header('X-RateLimit-Limit', String(max)); c.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    if (record.count > max) { const retry = Math.ceil((record.start + config.rateWindowMs - now) / 1000); c.header('Retry-After', String(retry)); console.warn(JSON.stringify({ event: 'rate_limited', request_id: c.get('requestId'), endpoint: c.req.path, source_hash: createHash('sha256').update(String(socketIp)).digest('hex').slice(0, 16), limit: max })); return error(c, 429, 'rate_limit_error', 'Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED', { retry_after: retry }); }
    await next();
  };
}
function boundedGeneration(c: any, next: () => Promise<void>) {
  if (activeGenerations >= config.concurrencyMax) return error(c, 503, 'service_unavailable_error', 'Generation capacity is temporarily full. Please try again shortly.', 'CAPACITY_EXCEEDED', { retry_after: 2 });
  activeGenerations++;
  return next().finally(() => { activeGenerations--; });
}
const validTemp = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 2);
const validMax = (v: unknown, fallback: number) => v === undefined ? fallback : Number.isInteger(v) && Number(v) >= 1 && Number(v) <= config.maxOutputTokens;
function modelFor(requested: unknown, capability: string): string | undefined {
  const records = modelRecords();
  if (requested === undefined || requested === 'default') return records.find(m => m.capabilities.includes(capability))?.id;
  if (typeof requested !== 'string') return undefined;
  return records.find(m => m.id === requested && m.capabilities.includes(capability))?.id;
}
function resolveModel(c: any, requested: unknown, capability: string): string | Response {
  const model = modelFor(requested, capability); if (model) return model;
  if (requested !== undefined && requested !== 'default') return error(c, 400, 'invalid_request_error', 'The requested model is not configured for this capability.', 'INVALID_MODEL');
  return noModel(c);
}
function validMessage(message: any): boolean {
  if (!message || !['system', 'user', 'assistant'].includes(message.role)) return false;
  if (typeof message.content === 'string') return message.content.trim().length > 0 && message.content.length <= 100_000;
  return Array.isArray(message.content) && message.content.length > 0 && message.content.length <= 50 && message.content.every((part: any) => part && part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0 && part.text.length <= 100_000);
}
function validateParams(body: any, c: any, fallback: number): Response | undefined {
  if (!validTemp(body.temperature)) return error(c, 400, 'invalid_request_error', 'temperature must be a number from 0 to 2.', 'INVALID_TEMPERATURE');
  if (!validMax(body.max_tokens, fallback)) return error(c, 400, 'invalid_request_error', `max_tokens must be an integer from 1 to ${config.maxOutputTokens}.`, 'INVALID_MAX_TOKENS');
}
const parseBody = async (c: any) => { try { return await c.req.json(); } catch { return null; } };
const noModel = (c: any) => error(c, 503, 'service_unavailable_error', 'No configured model is available for this capability.', 'MODEL_UNAVAILABLE');
function logProviderUsage(c: any, capability: string, result: any, fallbackModel: string) {
  console.info(JSON.stringify({ event: 'provider_request_complete', request_id: c.get('requestId'), capability, model: result.model ?? fallbackModel, input_tokens: result.usage?.prompt_tokens ?? null, output_tokens: result.usage?.completion_tokens ?? null }));
}

app.get('/api/v1/health', rateLimit(), c => c.json({ status: 'ok', service: 'OpenMuse', version: config.version, timestamp: new Date().toISOString() }));
app.get('/api/v1/models', rateLimit(), c => c.json({ object: 'list', data: modelRecords() }));
app.get('/api/v1/openapi.json', rateLimit(), async c => {
  try { return c.json(JSON.parse(await readFile(new URL('../../openapi/openapi.json', import.meta.url), 'utf8'))); }
  catch { return error(c, 503, 'service_unavailable_error', 'OpenAPI specification is not available.', 'SPEC_UNAVAILABLE'); }
});
app.get('/api/v1/metadata', rateLimit(), c => c.json({ service: 'OpenMuse', api_version: 'v1', image_storage: imageStorageMode, limits: { max_request_bytes: config.maxBodyBytes, max_output_tokens: config.maxOutputTokens, max_concurrent_generations: config.concurrencyMax, rate_limit_window_ms: config.rateWindowMs, requests_per_window: config.rateMax, expensive_requests_per_window: config.expensiveRateMax } }));
app.post('/api/v1/text', rateLimit(), boundedGeneration, async c => {
  const b = await parseBody(c); if (!b || typeof b.prompt !== 'string' || !b.prompt.trim()) return error(c, 400, 'invalid_request_error', 'prompt must be a non-empty string.', 'INVALID_PROMPT');
  if (b.prompt.length > 100_000) return error(c, 400, 'invalid_request_error', 'prompt exceeds the maximum length of 100000 characters.', 'INPUT_TOO_LARGE');
  const invalid = validateParams(b, c, Math.min(500, config.maxOutputTokens)); if (invalid) return invalid;
  const model = resolveModel(c, b.model, 'text'); if (model instanceof Response) return model;
  const result = await generateText(b.prompt, model, b.max_tokens ?? Math.min(500, config.maxOutputTokens), b.temperature ?? 0.7, c.req.raw.signal);
  logProviderUsage(c, 'text', result, model);
  const choice = result.choices?.[0]; if (typeof choice?.message?.content !== 'string') throw new ProviderError('AI provider returned an unsupported response.', 502);
  return c.json({ id: result.id ?? `gen_${randomUUID()}`, object: 'text.generation', created: result.created ?? Math.floor(Date.now() / 1000), model: result.model ?? model, output: { text: choice.message.content }, usage: { input_tokens: result.usage?.prompt_tokens ?? null, output_tokens: result.usage?.completion_tokens ?? null } });
});
app.post('/api/v1/chat', rateLimit(), boundedGeneration, async c => {
  const b = await parseBody(c); if (!Array.isArray(b?.messages) || b.messages.length < 1 || b.messages.length > 100) return error(c, 400, 'invalid_request_error', 'messages must be a non-empty array of at most 100 messages.', 'INVALID_MESSAGES');
  if (!b.messages.every(validMessage)) return error(c, 400, 'invalid_request_error', 'Each message must use a supported role and non-empty text content (string or text parts).', 'INVALID_MESSAGES');
  const invalid = validateParams(b, c, Math.min(500, config.maxOutputTokens)); if (invalid) return invalid;
  const model = resolveModel(c, b.model, 'chat'); if (model instanceof Response) return model;
  const result = await createChat(b.messages, model, b.max_tokens ?? Math.min(500, config.maxOutputTokens), b.temperature ?? 0.7, c.req.raw.signal);
  logProviderUsage(c, 'chat', result, model);
  const choice = result.choices?.[0]; if (!choice?.message || typeof choice.message.content !== 'string') throw new ProviderError('AI provider returned an unsupported response.', 502);
  return c.json({ id: result.id ?? `chat_${randomUUID()}`, object: 'chat.completion', created: result.created ?? Math.floor(Date.now() / 1000), model: result.model ?? model, choices: [{ index: 0, message: { role: 'assistant', content: choice.message.content }, finish_reason: choice.finish_reason ?? null }], usage: { input_tokens: result.usage?.prompt_tokens ?? null, output_tokens: result.usage?.completion_tokens ?? null } });
});
app.post('/api/v1/chat/stream', rateLimit(), boundedGeneration, async c => {
  const b = await parseBody(c); if (!Array.isArray(b?.messages) || !b.messages.length || b.messages.length > 100 || !b.messages.every((m: any) => validMessage(m) && typeof m.content === 'string')) return error(c, 400, 'invalid_request_error', 'messages must contain supported role/content pairs.', 'INVALID_MESSAGES');
  const invalid = validateParams(b, c, Math.min(500, config.maxOutputTokens)); if (invalid) return invalid;
  const model = resolveModel(c, b.model, 'chat'); if (model instanceof Response) return model;
  if (!config.textStreamingEnabled) return error(c, 503, 'service_unavailable_error', 'Native streaming is not enabled for the configured provider route.', 'STREAMING_UNAVAILABLE');
  const upstream = await streamChat(b.messages, model, b.max_tokens ?? Math.min(500, config.maxOutputTokens), b.temperature ?? 0.7, c.req.raw.signal);
  console.info(JSON.stringify({ event: 'provider_stream_started', request_id: c.get('requestId'), capability: 'chat_stream', model }));
  const reader = upstream.body!.getReader(); const decoder = new TextDecoder(); let buffer = ''; let ended = false; const id = `chat_${randomUUID()}`;
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send('message_start', { id });
      try {
        while (true) {
          const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue;
            try {
              const frame = JSON.parse(raw); const choice = frame.choices?.[0]; const text = choice?.delta?.content;
              if (typeof text === 'string' && text) send('content_delta', { text });
              if (choice?.finish_reason) { ended = true; send('message_end', { finish_reason: choice.finish_reason }); }
              if (frame.error) send('error', { message: 'AI provider stream failed.' });
            } catch { /* Ignore malformed provider frames, never leak raw upstream data. */ }
          }
          if (done) break;
        }
        if (!ended) send('message_end', { finish_reason: 'stop' });
        controller.enqueue(enc.encode('data: [DONE]\n\n')); controller.close();
      } catch { send('error', { message: 'AI provider stream was interrupted.' }); controller.enqueue(enc.encode('data: [DONE]\n\n')); controller.close(); }
      finally { reader.releaseLock(); }
    },
    async cancel() { await reader.cancel().catch(() => {}); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Request-Id': c.get('requestId') } });
});
app.post('/api/v1/images/generations', rateLimit(true), boundedGeneration, async c => {
  const b = await parseBody(c); if (!b || typeof b.prompt !== 'string' || !b.prompt.trim() || b.prompt.length > 10_000) return error(c, 400, 'invalid_request_error', 'prompt must be a non-empty string of at most 10000 characters.', 'INVALID_PROMPT');
  const size = b.size ?? '1024x1024'; if (!['256x256', '512x512', '1024x1024', '1024x1536', '1536x1024'].includes(size)) return error(c, 400, 'invalid_request_error', 'size must be one of 256x256, 512x512, 1024x1024, 1024x1536, or 1536x1024.', 'INVALID_SIZE');
  const model = resolveModel(c, b.model, 'image_generation'); if (model instanceof Response) return model;
  const result = await generateImage(b.prompt, model, size, c.req.raw.signal); logProviderUsage(c, 'image_generation', result, model); const item = result.data?.[0];
  if (!item?.b64_json) throw new ProviderError('Image provider returned no image data.', 502);
  const bytes = Buffer.from(item.b64_json, 'base64'); if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new ProviderError('Image provider returned invalid image data.', 502);
  try { validateImageBytes(bytes, 'image/png'); } catch { throw new ProviderError('Image provider returned invalid image data.', 502); }
  const [width, height] = size.split('x').map(Number); const id = `img_${randomUUID().replaceAll('-', '')}`; const created = Date.now();
  try { await imageStore.put({ id, bytes, contentType: 'image/png', width: width!, height: height!, created }); } catch { throw new StorageError(); }
  return c.json({ id, object: 'image.generation', status: 'completed', created: Math.floor(created / 1000), model: result.model ?? model, data: [{ id, url: `/api/v1/images/${id}`, width, height }] }, 201);
});
app.get('/api/v1/images/:id', rateLimit(), async c => {
  const id = c.req.param('id'); if (!/^img_[a-f0-9]{32}$/.test(id)) return error(c, 404, 'not_found_error', 'Image not found.', 'IMAGE_NOT_FOUND');
  let stored;
  try { stored = await imageStore.get(id); } catch { throw new StorageError(); }
  if (!stored) return error(c, 404, 'not_found_error', 'Image not found or expired.', 'IMAGE_NOT_FOUND');
  c.header('Content-Type', stored.contentType); c.header('Cache-Control', 'public, max-age=86400, immutable'); c.header('Content-Length', String(stored.bytes.byteLength));
  return new Response(stored.bytes as BodyInit, { headers: { 'Content-Type': stored.contentType, 'Cache-Control': 'public, max-age=86400, immutable', 'Content-Length': String(stored.bytes.byteLength), 'X-Request-Id': c.get('requestId') } });
});
function privateAddress(ip: string): boolean {
  if (ip === 'localhost' || ip.endsWith('.localhost')) return true;
  if (isIP(ip) === 4) { const nums = ip.split('.').map(Number); const [a, b, c] = nums; return a === 0 || a === 10 || a === 127 || a! >= 224 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113) || (a === 100 && b! >= 64 && b! <= 127); }
  const normalized = ip.toLowerCase();
  if (normalized.startsWith('::ffff:')) return true;
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff') || normalized.startsWith('2001:db8');
}
function validateImageBytes(bytes: Uint8Array, contentType: string): void {
  const b = Buffer.from(bytes);
  const valid = contentType === 'image/png' ? b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : contentType === 'image/jpeg' ? b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    : contentType === 'image/gif' ? b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'))
    : contentType === 'image/webp' ? b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
    : false;
  if (!valid) throw new Error('Image bytes do not match a supported image format.');
}
async function secureImageUrl(url: string): Promise<string> {
  let current = new URL(url);
  if (!['https:', 'http:'].includes(current.protocol) || current.username || current.password) throw new Error('Unsupported image URL.');
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (current.username || current.password) throw new Error('Image URL credentials are not allowed.');
    const host = current.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(a => privateAddress(a.address))) throw new Error('Image URL must resolve to a public address.');
    const pinned = addresses[0]!;
    const agent = new Agent({ connect: { lookup: ((_: string, options: any, callback: (...args: any[]) => void) => {
      const records = addresses.map(item => ({ address: item.address, family: isIP(item.address) }));
      if (options?.all) callback(null, records); else callback(null, pinned.address, isIP(pinned.address));
    }) as any } });
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { accept: 'image/png,image/jpeg,image/webp,image/gif' }, dispatcher: agent } as RequestInit & { dispatcher: Agent });
      if ([301, 302, 303, 307, 308].includes(response.status)) { const loc = response.headers.get('location'); await response.body?.cancel(); if (!loc || redirects === 3) throw new Error('Too many image URL redirects.'); current = new URL(loc, current); if (!['https:', 'http:'].includes(current.protocol)) throw new Error('Unsupported image URL.'); continue; }
      if (!response.ok) { await response.body?.cancel(); throw new Error('Could not retrieve the image URL.'); }
      const type = response.headers.get('content-type')?.split(';')[0] ?? ''; if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) { await response.body?.cancel(); throw new Error('Image URL must return a supported image content type.'); }
      const declared = Number(response.headers.get('content-length') ?? 0); if (declared > 5 * 1024 * 1024) { await response.body?.cancel(); throw new Error('Image exceeds the 5 MiB limit.'); }
      const reader = response.body?.getReader(); if (!reader) throw new Error('Image response is empty.');
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) { const r = await reader.read(); if (r.done) break; total += r.value.byteLength; if (total > 5 * 1024 * 1024) { await reader.cancel(); throw new Error('Image exceeds the 5 MiB limit.'); } chunks.push(r.value); }
      const bytes = Buffer.concat(chunks); validateImageBytes(bytes, type); return `data:${type};base64,${bytes.toString('base64')}`;
    } finally { clearTimeout(timer); await agent.close(); }
  }
  throw new Error('Could not securely retrieve image URL.');
}
app.post('/api/v1/vision', rateLimit(true), boundedGeneration, async c => {
  const b = await parseBody(c); if (!b || typeof b.prompt !== 'string' || !b.prompt.trim() || b.prompt.length > 10_000) return error(c, 400, 'invalid_request_error', 'prompt must be a non-empty string of at most 10000 characters.', 'INVALID_PROMPT');
  let imageUrl: string;
  try {
    const dataMatch = typeof b.image_data === 'string' ? b.image_data.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/) : null;
    if (dataMatch) {
      if (b.image_data.length > 7_000_000) throw new Error('Image exceeds the 5 MiB limit.');
      const bytes = Buffer.from(dataMatch[2]!, 'base64');
      if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64').replace(/=+$/, '') !== dataMatch[2]!.replace(/=+$/, '')) throw new Error('Invalid base64 image data.');
      validateImageBytes(bytes, `image/${dataMatch[1]}`); imageUrl = b.image_data;
    } else if (typeof b.image_url === 'string' && b.image_url.length <= 2048) imageUrl = await secureImageUrl(b.image_url);
    else return error(c, 400, 'invalid_request_error', 'Provide a public image_url or image_data as a base64 data URL.', 'INVALID_IMAGE');
  } catch (e) { return error(c, 400, 'invalid_request_error', e instanceof Error ? e.message : 'Invalid image input.', 'INVALID_IMAGE'); }
  const model = resolveModel(c, b.model, 'vision'); if (model instanceof Response) return model;
  const result = await analyzeImage(imageUrl, b.prompt, model, c.req.raw.signal); logProviderUsage(c, 'vision', result, model); const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ProviderError('AI provider returned an unsupported response.', 502);
  return c.json({ id: result.id ?? `vision_${randomUUID()}`, object: 'vision.analysis', created: result.created ?? Math.floor(Date.now() / 1000), model: result.model ?? model, output: { text: content }, usage: { input_tokens: result.usage?.prompt_tokens ?? null, output_tokens: result.usage?.completion_tokens ?? null } });
});
app.get('/', serveStatic({ root: './', path: '/dist/web/index.html', onFound: (_path, c) => c.header('Cache-Control', 'no-cache') }));
app.use('/assets/*', serveStatic({ root: './', rewriteRequestPath: path => `/dist/web${path}`, onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }));
app.notFound(c => error(c, 404, 'not_found_error', 'Route not found.', 'NOT_FOUND'));
