import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { getAzureCredential } from "./azure-credential";

export type StorageProvider = "s3" | "azure";
type AzureStorageAuthMode = "managed-identity" | "connection-string";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const S3_REGION = process.env.S3_REGION ?? "eu-west-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "control-equipos";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "control-equipos-secret";
const S3_BUCKET = process.env.S3_BUCKET ?? "control-equipos-documents";
const S3_FORCE_PATH_STYLE = (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";

const AZURE_STORAGE_CONTAINER =
  process.env.AZURE_STORAGE_CONTAINER ?? "control-equipos-documents";

let s3Client: S3Client | null = null;
let azureServiceClient: BlobServiceClient | null = null;
let azureContainerClient: ContainerClient | null = null;
let azureContainerReady: Promise<void> | null = null;

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER ?? "s3").trim().toLowerCase();
  if (provider === "s3" || provider === "azure") return provider;
  throw new Error(
    `STORAGE_PROVIDER no válido: "${provider}". Los valores permitidos son "s3" y "azure".`
  );
}

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });
  return s3Client;
}

function getAzureConnectionString(): string {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (!connectionString) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING es obligatorio cuando STORAGE_PROVIDER=azure."
    );
  }
  return connectionString;
}

function getAzureStorageAuthMode(): AzureStorageAuthMode {
  const mode = (process.env.AZURE_STORAGE_AUTH_MODE ?? "managed-identity")
    .trim()
    .toLowerCase();
  if (mode === "managed-identity" || mode === "connection-string") return mode;
  throw new Error(
    `AZURE_STORAGE_AUTH_MODE no válido: "${mode}". Usa "managed-identity" o "connection-string".`
  );
}

function getAzureServiceClient(): BlobServiceClient {
  if (azureServiceClient) return azureServiceClient;

  if (getAzureStorageAuthMode() === "connection-string") {
    azureServiceClient = BlobServiceClient.fromConnectionString(getAzureConnectionString());
    return azureServiceClient;
  }

  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL?.trim();
  if (!accountUrl) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_URL es obligatorio con Azure Storage Managed Identity."
    );
  }
  azureServiceClient = new BlobServiceClient(accountUrl, getAzureCredential());
  return azureServiceClient;
}

function getAzureContainerClient(): ContainerClient {
  if (azureContainerClient) return azureContainerClient;
  azureContainerClient = getAzureServiceClient().getContainerClient(AZURE_STORAGE_CONTAINER);
  return azureContainerClient;
}

async function ensureAzureContainer(): Promise<void> {
  if (!azureContainerReady) {
    azureContainerReady = getAzureContainerClient()
      .createIfNotExists()
      .then(() => undefined)
      .catch((error) => {
        azureContainerReady = null;
        throw error;
      });
  }
  await azureContainerReady;
}

export function getBucket(): string {
  return getStorageProvider() === "azure" ? AZURE_STORAGE_CONTAINER : S3_BUCKET;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<string> {
  if (getStorageProvider() === "azure") {
    await ensureAzureContainer();
    const blob = getAzureContainerClient().getBlockBlobClient(key);
    const data = Buffer.from(body);
    await blob.uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return key;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (getStorageProvider() === "azure") {
    return getAzureContainerClient().getBlockBlobClient(key).downloadToBuffer();
  }

  const res = await getS3Client().send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
  if (!res.Body) throw new Error(`Objeto S3 no encontrado: ${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getObjectStream(key: string): Promise<{
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  contentType: string | undefined;
  contentLength: number | undefined;
}> {
  if (getStorageProvider() === "azure") {
    const res = await getAzureContainerClient().getBlockBlobClient(key).download();
    if (!res.readableStreamBody) throw new Error(`Blob de Azure no encontrado: ${key}`);
    return {
      body: res.readableStreamBody,
      contentType: res.contentType,
      contentLength: res.contentLength,
    };
  }

  const res = await getS3Client().send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
  if (!res.Body) throw new Error(`Objeto S3 no encontrado: ${key}`);
  return {
    body: res.Body as ReadableStream<Uint8Array>,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

export async function deleteObject(key: string): Promise<void> {
  if (getStorageProvider() === "azure") {
    await getAzureContainerClient().getBlockBlobClient(key).deleteIfExists();
    return;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}

function parseAzureSharedKeyCredential(): StorageSharedKeyCredential {
  const values = new Map<string, string>();
  for (const part of getAzureConnectionString().split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values.set(part.slice(0, separator), part.slice(separator + 1));
  }

  const accountName = values.get("AccountName");
  const accountKey = values.get("AccountKey");
  if (!accountName || !accountKey) {
    throw new Error(
      "La URL SAS requiere AccountName y AccountKey en AZURE_STORAGE_CONNECTION_STRING."
    );
  }
  return new StorageSharedKeyCredential(accountName, accountKey);
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  if (getStorageProvider() === "azure") {
    const blob = getAzureContainerClient().getBlockBlobClient(key);
    const now = new Date();
    const startsOn = new Date(now.getTime() - 60_000);
    const expiresOn = new Date(now.getTime() + expiresInSeconds * 1000);
    const serviceClient = getAzureServiceClient();
    const sasOptions = {
      containerName: AZURE_STORAGE_CONTAINER,
      blobName: key,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
    };
    const sas =
      getAzureStorageAuthMode() === "managed-identity"
        ? generateBlobSASQueryParameters(
            sasOptions,
            await serviceClient.getUserDelegationKey(startsOn, expiresOn),
            serviceClient.accountName
          )
        : generateBlobSASQueryParameters(sasOptions, parseAzureSharedKeyCredential());
    return `${blob.url}?${sas.toString()}`;
  }

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function checkStorage(): Promise<boolean> {
  try {
    if (getStorageProvider() === "azure") {
      return await getAzureContainerClient().exists();
    }
    await getS3Client().send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    return true;
  } catch (error) {
    console.error(`[storage:${getStorageProvider()}] Almacenamiento no accesible:`, error);
    return false;
  }
}

export const checkBucket = checkStorage;

export function reciboPdfKey(reciboId: number): string {
  const year = new Date().getFullYear();
  return `recibos/${year}/${reciboId}.pdf`;
}

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
