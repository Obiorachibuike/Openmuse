import { OpenMuseAPIError, OpenMuseConnectionError, OpenMuseRateLimitError, OpenMuseTimeoutError } from './errors.js';
import type { ChatRequest, ChatResult, ChatStreamEvent, Health, ImageRequest, ImageResult, ModelList, RequestOptions, TextRequest, TextResult, VisionRequest, VisionResult } from './types.js';

export interface OpenMuseOptions { baseURL?: string; timeout?: number; fetch?: typeof fetch }
const DEFAULT_BASE = 'https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1';
export class OpenMuse {
  readonly baseURL: string;
  readonly timeout: number;
  private readonly fetcher: typeof fetch;
  readonly text = { generate: (params: TextRequest, options?: RequestOptions) => this.request<TextResult>('/text', params, options) };
  readonly chat = {
    create: (params: ChatRequest, options?: RequestOptions) => this.request<ChatResult>('/chat', params, options),
    stream: (params: ChatRequest, options?: RequestOptions) => this.streamRequest('/chat/stream', params, options),
  };
  readonly images = {
    generate: (params: ImageRequest, options?: RequestOptions) => this.request<ImageResult>('/images/generations', params, options),
    retrieve: async (id: string, options?: RequestOptions) => {
      if (!/^img_[a-f0-9]{32}$/.test(id)) throw new TypeError('Invalid OpenMuse image id.');
      const response = await this.raw(`/images/${encodeURIComponent(id)}`, { method: 'GET' }, options);
      if (!response.ok) throw await this.apiError(response);
      return response;
    },
  };
  readonly vision = { analyze: (params: VisionRequest, options?: RequestOptions) => this.request<VisionResult>('/vision', params, options) };
  readonly models = { list: () => this.request<ModelList>('/models', undefined, undefined, 'GET') };
  readonly health = { check: () => this.request<Health>('/health', undefined, undefined, 'GET') };

  constructor(options: OpenMuseOptions = {}) {
    this.baseURL = (options.baseURL ?? DEFAULT_BASE).replace(/\/$/, '');
    this.timeout = options.timeout ?? 30_000;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0) throw new TypeError('timeout must be a positive number of milliseconds.');
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new TypeError('A Fetch implementation is required.');
  }
  private async raw(path: string, init: RequestInit, options?: RequestOptions): Promise<Response> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new Error('OpenMuse timeout')), this.timeout);
    const abort = () => controller.abort(options?.signal?.reason); options?.signal?.addEventListener('abort', abort, { once: true });
    if (options?.signal?.aborted) abort();
    try { return await this.fetcher(`${this.baseURL}${path}`, { ...init, signal: controller.signal }); }
    catch (e) {
      if (controller.signal.aborted && !options?.signal?.aborted) throw new OpenMuseTimeoutError(`OpenMuse request timed out after ${this.timeout} ms.`, { cause: e });
      if (options?.signal?.aborted) throw e;
      throw new OpenMuseConnectionError('Could not connect to OpenMuse.', { cause: e });
    } finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', abort); }
  }
  private async request<T>(path: string, body?: unknown, options?: RequestOptions, method = 'POST'): Promise<T> {
    const response = await this.raw(path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }, options);
    if (!response.ok) throw await this.apiError(response);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) throw new OpenMuseAPIError('OpenMuse returned an unexpected content type.', response.status);
    return response.json() as Promise<T>;
  }
  private async apiError(response: Response): Promise<OpenMuseAPIError> {
    let data: any; try { data = await response.json(); } catch { data = {}; }
    const err = data?.error ?? {}; const retryAfter = Number(response.headers.get('retry-after') ?? err.retry_after) || undefined;
    const Ctor = response.status === 429 ? OpenMuseRateLimitError : OpenMuseAPIError;
    return new Ctor(err.message ?? `OpenMuse request failed with HTTP ${response.status}.`, response.status, err.code, err.request_id ?? response.headers.get('x-request-id') ?? undefined, retryAfter, err.type);
  }
  private async *streamRequest(path: string, body: unknown, options?: RequestOptions): AsyncGenerator<ChatStreamEvent> {
    const controller = new AbortController(); let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeout);
    const onAbort = () => controller.abort(options?.signal?.reason);
    options?.signal?.addEventListener('abort', onAbort, { once: true });
    if (options?.signal?.aborted) onAbort();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      let response: Response;
      try { response = await this.fetcher(`${this.baseURL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify(body), signal: controller.signal }); }
      catch (e) {
        if (timedOut) throw new OpenMuseTimeoutError(`OpenMuse stream timed out after ${this.timeout} ms.`, { cause: e });
        if (options?.signal?.aborted) throw e;
        throw new OpenMuseConnectionError('Could not connect to OpenMuse.', { cause: e });
      }
      if (!response.ok) throw await this.apiError(response);
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new OpenMuseAPIError('OpenMuse returned an invalid stream response.', response.status);
      reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      const parse = (frame: string): ChatStreamEvent | undefined => {
        const name = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim() ?? 'message';
        const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!payload || payload === '[DONE]') return undefined;
        try { const obj = JSON.parse(payload); if (name === 'message_start') return { type: name, id: obj.id }; if (name === 'content_delta') return { type: name, text: obj.text }; if (name === 'message_end') return { type: name, finish_reason: obj.finish_reason }; if (name === 'error') return { type: name, message: obj.message ?? 'Stream failed.' }; }
        catch { throw new OpenMuseAPIError('OpenMuse returned malformed SSE data.', response.status); }
      };
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try { chunk = await reader.read(); }
        catch (e) { if (timedOut) throw new OpenMuseTimeoutError(`OpenMuse stream timed out after ${this.timeout} ms.`, { cause: e }); throw e; }
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        let boundary: number;
        while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) { const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)![0]; const frame = buffer.slice(0, boundary).replace(/\r\n/g, '\n').replace(/\r/g, '\n'); buffer = buffer.slice(boundary + separator.length); const event = parse(frame); if (event) yield event; if (frame.includes('data: [DONE]')) return; }
        if (chunk.done) break;
      }
      if (buffer.trim()) { const event = parse(buffer); if (event) yield event; }
    } finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', onAbort); if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
  }
}
