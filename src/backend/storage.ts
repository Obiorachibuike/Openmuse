import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config.js';

export class StorageError extends Error { constructor() { super('Image storage is unavailable.'); } }
export interface StoredImage { id: string; contentType: string; bytes: Uint8Array; width: number; height: number; created: number }
export interface ImageStore { put(image: StoredImage): Promise<void>; get(id: string): Promise<StoredImage | undefined> }
const memory = new Map<string, StoredImage>();
export class MemoryImageStore implements ImageStore {
  async put(image: StoredImage) { memory.set(image.id, image); }
  async get(id: string) { const image = memory.get(id); if (!image) return undefined; if (Date.now() - image.created > config.imageRetentionDays * 86_400_000) { memory.delete(id); return undefined; } return image; }
}
class S3ImageStore implements ImageStore {
  private client = new S3Client({ region: config.s3Region, endpoint: config.s3Endpoint, forcePathStyle: config.s3ForcePathStyle });
  async put(image: StoredImage) {
    const imageKey = `openmuse-images/${image.id}`;
    await this.client.send(new PutObjectCommand({ Bucket: config.s3Bucket!, Key: imageKey, Body: image.bytes, ContentType: image.contentType }));
    const metadata = JSON.stringify({ id: image.id, contentType: image.contentType, width: image.width, height: image.height, created: image.created, retentionDays: config.imageRetentionDays });
    try { await this.client.send(new PutObjectCommand({ Bucket: config.s3Bucket!, Key: `openmuse-image-metadata/${image.id}.json`, Body: metadata, ContentType: 'application/json' })); }
    catch (err) { await this.client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket!, Key: imageKey })).catch(() => {}); throw err; }
  }
  async get(id: string) {
    try {
      const manifest = await this.client.send(new GetObjectCommand({ Bucket: config.s3Bucket!, Key: `openmuse-image-metadata/${id}.json` }));
      if (!manifest.Body) return undefined;
      const metadata = JSON.parse(await manifest.Body.transformToString());
      const created = Number(metadata.created ?? 0);
      if (!created || Date.now() - created > config.imageRetentionDays * 86_400_000) return undefined;
      const obj = await this.client.send(new GetObjectCommand({ Bucket: config.s3Bucket!, Key: `openmuse-images/${id}` }));
      if (!obj.Body) return undefined;
      return { id, bytes: await obj.Body.transformToByteArray(), contentType: metadata.contentType ?? obj.ContentType ?? 'application/octet-stream', width: Number(metadata.width ?? 0), height: Number(metadata.height ?? 0), created };
    } catch (e: any) { if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return undefined; throw e; }
  }
}
export const imageStore: ImageStore = config.s3Bucket ? new S3ImageStore() : new MemoryImageStore();
export const imageStorageMode = config.s3Bucket ? 's3' : 'memory';
