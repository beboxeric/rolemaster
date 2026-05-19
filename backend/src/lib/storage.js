// Cloudflare R2 via S3-compatible API.
// Falls back to a no-op when credentials are not configured (local dev).
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function getClient() {
  if (!process.env.R2_ACCOUNT_ID) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

export async function uploadFile(key, buffer, contentType = 'application/octet-stream') {
  const client = getClient();
  if (!client) {
    console.warn('[storage] R2 not configured — file upload skipped for key:', key);
    return;
  }
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

export async function deleteFile(key) {
  const client = getClient();
  if (!client) return;
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }));
}

export function publicUrl(key) {
  const base = process.env.R2_PUBLIC_URL;
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}
