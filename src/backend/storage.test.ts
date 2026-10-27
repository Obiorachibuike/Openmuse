import { describe, it, expect } from 'vitest';
import { MemoryImageStore } from './storage.js';

describe('image storage adapter', () => {
  it('writes, retrieves, and misses image objects by opaque id', async () => {
    const store = new MemoryImageStore(); const id = `img_${'a'.repeat(32)}`;
    const image = { id, bytes: new Uint8Array([137, 80, 78, 71]), contentType: 'image/png', width: 1, height: 1, created: Date.now() };
    await store.put(image); expect(await store.get(id)).toEqual(image); expect(await store.get(`img_${'b'.repeat(32)}`)).toBeUndefined();
  });
});
