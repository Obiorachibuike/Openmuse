export interface RequestOptions { signal?: AbortSignal }
export interface GenerationOptions { model?: string; max_tokens?: number; temperature?: number }
export interface TextRequest extends GenerationOptions { prompt: string }
export interface TextResult { id: string; object: 'text.generation'; created: number; model: string; output: { text: string }; usage: { input_tokens: number | null; output_tokens: number | null } }
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string | unknown[] }
export interface ChatRequest extends GenerationOptions { messages: ChatMessage[] }
export interface ChatResult { id: string; object: 'chat.completion'; created: number; model: string; choices: Array<{ index: number; message: ChatMessage; finish_reason: string | null }>; usage: { input_tokens: number | null; output_tokens: number | null } }
export type ChatStreamEvent = { type: 'message_start'; id: string } | { type: 'content_delta'; text: string } | { type: 'message_end'; finish_reason: string } | { type: 'error'; message: string };
export interface ImageRequest { prompt: string; model?: string; size?: '256x256' | '512x512' | '1024x1024' | '1024x1536' | '1536x1024' }
export interface ImageResult { id: string; object: 'image.generation'; status: 'completed'; created: number; model: string; data: Array<{ id: string; url: string; width: number; height: number }> }
export interface VisionRequest { image_url?: string; image_data?: string; prompt: string; model?: string }
export interface VisionResult { id: string; object: 'vision.analysis'; created: number; model: string; output: { text: string }; usage: { input_tokens: number | null; output_tokens: number | null } }
export interface Model { id: string; object: 'model'; name: string; provider: string; availability: boolean; capabilities: string[]; streaming: boolean; vision: boolean; image_generation: boolean; parameter_limits: { max_tokens: { min: number; max: number }; temperature: { min: number; max: number } } }
export interface ModelList { object: 'list'; data: Model[] }
export interface Health { status: 'ok'; service: string; version: string; timestamp: string }
