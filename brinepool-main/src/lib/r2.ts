import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

let _r2: S3Client | null = null;

function getR2() {
  if (!_r2) {
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _r2;
}

function getBucket() {
  return process.env.R2_BUCKET_NAME!;
}

export async function uploadToR2(key: string, body: Buffer | string, contentType = "text/plain") {
  await getR2().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getFromR2(key: string): Promise<string | null> {
  try {
    const result = await getR2().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return (await result.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
}

export async function listR2Objects(prefix: string) {
  const result = await getR2().send(
    new ListObjectsV2Command({ Bucket: getBucket(), Prefix: prefix })
  );
  return result.Contents ?? [];
}

export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
