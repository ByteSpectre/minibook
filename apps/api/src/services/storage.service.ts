import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import sharp from 'sharp';
import { LIMITS, type UploadResponse } from '@nail-crm/shared';
import { env } from '../config';
import { badRequest } from '../lib/errors';

interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
}

class LocalDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  async put(key: string, body: Buffer): Promise<string> {
    const file = path.resolve(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `/uploads/${key}`;
  }
}

class R2Driver implements StorageDriver {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY, secretAccessKey: env.R2_SECRET_KEY },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
  }
}

export const uploadDir = path.resolve(env.UPLOAD_DIR);

const driver: StorageDriver =
  env.STORAGE_DRIVER === 'r2' && env.R2_ACCOUNT_ID && env.R2_BUCKET
    ? new R2Driver()
    : new LocalDriver(uploadDir);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|heic|heif|gif|avif)$/.test(file.mimetype)) {
      cb(badRequest('unsupportedFile', 'Only images are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

const SIZES: Record<string, number> = {
  avatar: 640,
  service: 800,
  category: 256,
  theme: 1600,
  blocked: 1200,
  broadcast: 1600,
  appointment: 1600,
  reference: 1600,
  review: 1600,
};

/** Re-encodes any uploaded image to WebP (EXIF-rotated, metadata stripped, resized). */
export async function storeImage(
  file: Express.Multer.File | undefined,
  kind: string,
  ownerPrefix: string,
): Promise<UploadResponse> {
  if (!file) throw badRequest('uploadFailed', 'File is required');
  const maxSide = SIZES[kind] ?? 1600;
  let output: { data: Buffer; info: { width: number; height: number } };
  try {
    output = await sharp(file.buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest('unsupportedFile', 'Invalid image');
  }
  const now = new Date();
  const key = `${kind}/${ownerPrefix}/${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.webp`;
  const url = await driver.put(key, output.data, 'image/webp');
  return { url, width: output.info.width, height: output.info.height };
}
