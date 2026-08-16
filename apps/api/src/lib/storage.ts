import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

function createStorageClient() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const client = createStorageClient();
const bucket = process.env.R2_BUCKET_NAME ?? 'theo-projects';

export async function uploadFile(key: string, content: string | Buffer): Promise<void> {
  if (!client) throw new Error('Storage not configured — set R2 credentials');
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content }));
}

export async function downloadFile(key: string): Promise<string> {
  if (!client) throw new Error('Storage not configured');
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return await result.Body!.transformToString();
}

export async function listFiles(prefix: string): Promise<string[]> {
  if (!client) throw new Error('Storage not configured');
  const result = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );
  return (result.Contents ?? []).map((obj) => obj.Key!).filter(Boolean);
}

export async function deleteFile(key: string): Promise<void> {
  if (!client) throw new Error('Storage not configured');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
