import { config } from './config.js';

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}
const endpoint = (path: string) => `${config.providerBaseUrl}/${path}`;
async function call(path: string, body: unknown, signal?: AbortSignal): Promise<any> {
  if (!config.providerKey) throw new ProviderError('AI provider is not configured.', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const onAbort = () => controller.abort(); signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(endpoint(path), { method: 'POST', headers: { authorization: `Bearer ${config.providerKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) {
      if (response.body) await response.body.cancel().catch(() => {});
      throw new ProviderError(response.status >= 500 ? 'AI provider is temporarily unavailable.' : 'AI provider rejected the request.', response.status === 429 ? 503 : 502);
    }
    return await response.json();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (controller.signal.aborted) throw new ProviderError('AI provider request timed out.', 504);
    throw new ProviderError('Unable to reach the AI provider.', 502);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}
export async function generateText(prompt: string, model: string, max_tokens: number, temperature: number, signal?: AbortSignal) {
  return call('chat/completions', { model, messages: [{ role: 'user', content: prompt }], max_tokens, temperature }, signal);
}
export async function createChat(messages: unknown[], model: string, max_tokens: number, temperature: number, signal?: AbortSignal) {
  return call('chat/completions', { model, messages, max_tokens, temperature }, signal);
}
export async function streamChat(messages: unknown[], model: string, max_tokens: number, temperature: number, signal: AbortSignal): Promise<Response> {
  if (!config.providerKey) throw new ProviderError('AI provider is not configured.', 503);
  const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
  const onAbort = () => controller.abort(); signal.addEventListener('abort', onAbort, { once: true });
  const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); };
  try {
    const response = await fetch(endpoint('chat/completions'), { method: 'POST', headers: { authorization: `Bearer ${config.providerKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, max_tokens, temperature, stream: true }), signal: controller.signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {}); cleanup();
      throw new ProviderError('AI provider could not start a streaming response.', response.status === 429 ? 503 : 502);
    }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        try { const chunk = await reader.read(); if (chunk.done) { cleanup(); output.close(); } else output.enqueue(chunk.value); }
        catch (err) { cleanup(); output.error(err); }
      },
      async cancel(reason) { cleanup(); controller.abort(); await reader.cancel(reason).catch(() => {}); },
    });
    return new Response(body);
  } catch (e) { cleanup(); if (e instanceof ProviderError) throw e; if (timedOut) throw new ProviderError('AI provider stream timed out.', 504); throw new ProviderError('Unable to start provider stream.', 502); }
}
export async function generateImage(prompt: string, model: string, size: string, signal?: AbortSignal) {
  return call('images/generations', { model, prompt, size, response_format: 'b64_json' }, signal);
}
export async function analyzeImage(imageUrl: string, prompt: string, model: string, signal?: AbortSignal) {
  return call('chat/completions', { model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }] }], max_tokens: 500 }, signal);
}
