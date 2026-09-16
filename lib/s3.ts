import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const S3_REGION = process.env.S3_REGION ?? "eu-west-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "control-equipos";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "control-equipos-secret";
const S3_BUCKET = process.env.S3_BUCKET ?? "control-equipos-documents";
const S3_FORCE_PATH_STYLE = (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });
  return _client;
}

export function getBucket(): string {
  return S3_BUCKET;
}

/**
 * Sube un objeto al bucket y devuelve su key.
 * El objeto se sube como privado (el bucket no debe tener política pública).
 */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Obtiene un objeto como Buffer.
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const client = getS3Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
  if (!res.Body) throw new Error(`S3 object not found: ${key}`);
  const chunks: Buffer[] = [];
  // Nodejs ReadableStream implements AsyncIterable<Buffer>
  for await (const chunk of res.Body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Obtiene un objeto como stream legible.
 */
export async function getObjectStream(key: string): Promise<{
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  contentType: string | undefined;
  contentLength: number | undefined;
}> {
  const client = getS3Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
  if (!res.Body) throw new Error(`S3 object not found: ${key}`);
  return {
    body: res.Body as ReadableStream<Uint8Array>,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

/**
 * Elimina un objeto.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}

/**
 * Genera una URL prefirmada para descarga directa (opcional, no se usa para servir
 * al usuario — los archivos siempre se sirven a través de rutas API autenticadas).
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const client = getS3Client();
  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return await getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

/**
 * Comprueba si el bucket está accesible (para healthcheck).
 */
export async function checkBucket(): Promise<boolean> {
  try {
    const client = getS3Client();
    // Cualquier operación barata sirve; usamos headBucket indirectamente
    await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: "__healthcheck__" })).catch((err) => {
      // 404 es OK: significa que el bucket existe
      if (err?.$metadata?.httpStatusCode === 404) return;
      throw err;
    });
    return true;
  } catch (err) {
    console.error("[s3] Bucket no accesible:", err);
    return false;
  }
}

/**
 * Construye la key del PDF de un recibo.
 */
export function reciboPdfKey(reciboId: number): string {
  const year = new Date().getFullYear();
  return `recibos/${year}/${reciboId}.pdf`;
}

/**
 * Construye la key del justificante subido por un jugador.
 */
export function justificanteKey(reciboJugadorId: string, originalName: string): string {
  const year = new Date().getFullYear();
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `justificantes/${year}/${reciboJugadorId}/${Date.now()}-${safe}`;
}

export function documentoJugadorKey(
  solicitudDocumentoJugadorId: string,
  originalName: string
): string {
  const year = new Date().getFullYear();
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `documentos/${year}/${solicitudDocumentoJugadorId}/${Date.now()}-${safe}`;
}

export function consentimientoPdfKey(consentimientoJugadorId: string): string {
  const year = new Date().getFullYear();
  return `consentimientos/${year}/${consentimientoJugadorId}/${Date.now()}.pdf`;
}

export function fotoJugadorKey(jugadorId: string, extension: string): string {
  return `jugadores/${jugadorId}/foto/${Date.now()}.${extension}`;
}

export function logoClubKey(extension: string): string {
  return `club/logo/${Date.now()}.${extension}`;
}