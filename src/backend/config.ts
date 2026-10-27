export const config = {
  version: process.env.npm_package_version ?? '1.0.0',
  apiBaseUrl: (process.env.OPENMUSE_API_BASE_URL ?? 'https://openmuse-api-yjd904.v2.appdeploy.ai/api/v1').replace(/\/$/, ''),
  providerBaseUrl: (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
  providerKey: process.env.OPENAI_API_KEY,
  textModel: process.env.OPENMUSE_TEXT_MODEL,
  textStreamingEnabled: process.env.OPENMUSE_TEXT_STREAMING_ENABLED === 'true',
  visionModel: process.env.OPENMUSE_VISION_MODEL,
  imageModel: process.env.OPENMUSE_IMAGE_MODEL,
  timeoutMs: boundedInt('OPENMUSE_REQUEST_TIMEOUT_MS', 30_000, 1_000, 120_000),
  maxOutputTokens: boundedInt('OPENMUSE_MAX_OUTPUT_TOKENS', 4_096, 1, 4_096),
  maxBodyBytes: boundedInt('OPENMUSE_MAX_REQUEST_BODY_BYTES', 8_388_608, 1_024, 10_485_760),
  rateWindowMs: boundedInt('OPENMUSE_RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000),
  rateMax: boundedInt('OPENMUSE_RATE_LIMIT_MAX_REQUESTS', 30, 1, 100_000),
  expensiveRateMax: boundedInt('OPENMUSE_EXPENSIVE_RATE_LIMIT_MAX_REQUESTS', 3, 1, 10_000),
  concurrencyMax: boundedInt('OPENMUSE_MAX_CONCURRENT_GENERATIONS', 4, 1, 1_000),
  imageRetentionDays: boundedInt('OPENMUSE_IMAGE_RETENTION_DAYS', 7, 1, 3_650),
  s3Bucket: process.env.OPENMUSE_S3_BUCKET,
  s3Region: process.env.AWS_REGION ?? process.env.OPENMUSE_S3_REGION ?? 'us-east-1',
  s3Endpoint: process.env.OPENMUSE_S3_ENDPOINT,
  s3ForcePathStyle: process.env.OPENMUSE_S3_FORCE_PATH_STYLE === 'true',
};
function boundedInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
