import type { MarketBotConfig } from "marketbot/plugin-sdk";
import type { FeishuConfig } from "./types.js";
import { createFeishuClient } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";
import fs from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";

type FeishuApiResponse = {
  code?: number;
  msg?: string;
  message_id?: string;
  data?: {
    message_id?: string;
    image_key?: string;
    file_key?: string;
  };
};

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".tiff",
  ".tif",
]);

function ensureFeishuApiSuccess(response: unknown, operation: string): FeishuApiResponse {
  const result = (response ?? {}) as FeishuApiResponse;
  // SDK may omit `code` on success; only fail on explicit non-zero code.
  if (typeof result.code === "number" && result.code !== 0) {
    throw new Error(`Feishu ${operation} failed: ${result.msg || `code ${result.code}`}`);
  }
  return result;
}

function extractMessageId(response: FeishuApiResponse): string {
  return response.data?.message_id ?? response.message_id ?? "unknown";
}

function normalizeContentType(contentType?: string | null): string | undefined {
  const base = contentType?.split(";")[0]?.trim().toLowerCase();
  return base || undefined;
}

function hasImageExtension(fileName?: string): boolean {
  if (!fileName) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function looksLikeImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // GIF: "GIF8"
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true;
  }

  // WEBP: "RIFF....WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  // BMP: "BM"
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return true;
  }

  // ICO: 00 00 01 00
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return true;
  }

  // TIFF: "II*\0" or "MM\0*"
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return true;
  }

  return false;
}

export function isImageMediaFeishu(params: {
  fileName?: string;
  contentType?: string;
  buffer: Buffer;
}): boolean {
  if (hasImageExtension(params.fileName)) {
    return true;
  }
  const normalizedType = normalizeContentType(params.contentType);
  if (normalizedType?.startsWith("image/")) {
    return true;
  }
  return looksLikeImageBuffer(params.buffer);
}

export type DownloadImageResult = {
  buffer: Buffer;
  contentType?: string;
};

export type DownloadMessageResourceResult = {
  buffer: Buffer;
  contentType?: string;
  fileName?: string;
};

/**
 * Download an image from Feishu using image_key.
 * Used for downloading images sent in messages.
 */
export async function downloadImageFeishu(params: {
  cfg: MarketBotConfig;
  imageKey: string;
}): Promise<DownloadImageResult> {
  const { cfg, imageKey } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  const response = await client.im.image.get({
    path: { image_key: imageKey },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(
      `Feishu image download failed: ${responseAny.msg || `code ${responseAny.code}`}`,
    );
  }

  // Handle various response formats from Feishu SDK
  let buffer: Buffer;

  if (Buffer.isBuffer(response)) {
    buffer = response;
  } else if (response instanceof ArrayBuffer) {
    buffer = Buffer.from(response);
  } else if (responseAny.data && Buffer.isBuffer(responseAny.data)) {
    buffer = responseAny.data;
  } else if (responseAny.data instanceof ArrayBuffer) {
    buffer = Buffer.from(responseAny.data);
  } else if (typeof responseAny.getReadableStream === "function") {
    // SDK provides getReadableStream method
    const stream = responseAny.getReadableStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else if (typeof responseAny.writeFile === "function") {
    // SDK provides writeFile method - use a temp file
    const tmpPath = path.join(os.tmpdir(), `feishu_img_${Date.now()}_${imageKey}`);
    await responseAny.writeFile(tmpPath);
    buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath).catch(() => {}); // cleanup
  } else if (typeof responseAny[Symbol.asyncIterator] === "function") {
    // Response is an async iterable
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else if (typeof responseAny.read === "function") {
    // Response is a Readable stream
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else {
    // Debug: log what we actually received
    const keys = Object.keys(responseAny);
    const types = keys.map((k) => `${k}: ${typeof responseAny[k]}`).join(", ");
    throw new Error(`Feishu image download failed: unexpected response format. Keys: [${types}]`);
  }

  return { buffer };
}

/**
 * Download a message resource (file/image/audio/video) from Feishu.
 * Used for downloading files, audio, and video from messages.
 */
export async function downloadMessageResourceFeishu(params: {
  cfg: MarketBotConfig;
  messageId: string;
  fileKey: string;
  type: "image" | "file";
}): Promise<DownloadMessageResourceResult> {
  const { cfg, messageId, fileKey, type } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  const response = await client.im.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(
      `Feishu message resource download failed: ${responseAny.msg || `code ${responseAny.code}`}`,
    );
  }

  // Handle various response formats from Feishu SDK
  let buffer: Buffer;

  if (Buffer.isBuffer(response)) {
    buffer = response;
  } else if (response instanceof ArrayBuffer) {
    buffer = Buffer.from(response);
  } else if (responseAny.data && Buffer.isBuffer(responseAny.data)) {
    buffer = responseAny.data;
  } else if (responseAny.data instanceof ArrayBuffer) {
    buffer = Buffer.from(responseAny.data);
  } else if (typeof responseAny.getReadableStream === "function") {
    // SDK provides getReadableStream method
    const stream = responseAny.getReadableStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else if (typeof responseAny.writeFile === "function") {
    // SDK provides writeFile method - use a temp file
    const tmpPath = path.join(os.tmpdir(), `feishu_${Date.now()}_${fileKey}`);
    await responseAny.writeFile(tmpPath);
    buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath).catch(() => {}); // cleanup
  } else if (typeof responseAny[Symbol.asyncIterator] === "function") {
    // Response is an async iterable
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else if (typeof responseAny.read === "function") {
    // Response is a Readable stream
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else {
    // Debug: log what we actually received
    const keys = Object.keys(responseAny);
    const types = keys.map((k) => `${k}: ${typeof responseAny[k]}`).join(", ");
    throw new Error(
      `Feishu message resource download failed: unexpected response format. Keys: [${types}]`,
    );
  }

  return { buffer };
}

export type UploadImageResult = {
  imageKey: string;
};

export type UploadFileResult = {
  fileKey: string;
};

export type SendMediaResult = {
  messageId: string;
  chatId: string;
};

/**
 * Upload an image to Feishu and get an image_key for sending.
 * Supports: JPEG, PNG, WEBP, GIF, TIFF, BMP, ICO
 */
export async function uploadImageFeishu(params: {
  cfg: MarketBotConfig;
  image: Buffer | string; // Buffer or file path
  imageType?: "message" | "avatar";
}): Promise<UploadImageResult> {
  const { cfg, image, imageType = "message" } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  // SDK expects a Readable stream, not a Buffer
  // Use type assertion since SDK actually accepts any Readable at runtime
  const imageStream = typeof image === "string" ? fs.createReadStream(image) : Readable.from(image);

  const response = await client.im.image.create({
    data: {
      image_type: imageType,
      image: imageStream as any,
    },
  });

  const responseAny = ensureFeishuApiSuccess(response, "image upload");

  const imageKey = responseAny.image_key ?? responseAny.data?.image_key;
  if (!imageKey) {
    throw new Error("Feishu image upload failed: no image_key returned");
  }

  return { imageKey };
}

/**
 * Upload a file to Feishu and get a file_key for sending.
 * Max file size: 30MB
 */
export async function uploadFileFeishu(params: {
  cfg: MarketBotConfig;
  file: Buffer | string; // Buffer or file path
  fileName: string;
  fileType: "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream";
  duration?: number; // Required for audio/video files, in milliseconds
}): Promise<UploadFileResult> {
  const { cfg, file, fileName, fileType, duration } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  // SDK expects a Readable stream, not a Buffer
  // Use type assertion since SDK actually accepts any Readable at runtime
  const fileStream = typeof file === "string" ? fs.createReadStream(file) : Readable.from(file);

  const response = await client.im.file.create({
    data: {
      file_type: fileType,
      file_name: fileName,
      file: fileStream as any,
      ...(duration !== undefined && { duration }),
    },
  });

  const responseAny = ensureFeishuApiSuccess(response, "file upload");

  const fileKey = responseAny.file_key ?? responseAny.data?.file_key;
  if (!fileKey) {
    throw new Error("Feishu file upload failed: no file_key returned");
  }

  return { fileKey };
}

/**
 * Send an image message using an image_key
 */
export async function sendImageFeishu(params: {
  cfg: MarketBotConfig;
  to: string;
  imageKey: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, imageKey, replyToMessageId } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`Invalid Feishu target: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ image_key: imageKey });

  if (replyToMessageId) {
    const response = ensureFeishuApiSuccess(
      await client.im.message.reply({
        path: { message_id: replyToMessageId },
        data: {
          content,
          msg_type: "image",
        },
      }),
      "image reply",
    );

    return {
      messageId: extractMessageId(response),
      chatId: receiveId,
    };
  }

  const response = ensureFeishuApiSuccess(
    await client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        content,
        msg_type: "image",
      },
    }),
    "image send",
  );

  return {
    messageId: extractMessageId(response),
    chatId: receiveId,
  };
}

/**
 * Send a file message using a file_key
 */
export async function sendFileFeishu(params: {
  cfg: MarketBotConfig;
  to: string;
  fileKey: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, fileKey, replyToMessageId } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`Invalid Feishu target: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ file_key: fileKey });

  if (replyToMessageId) {
    const response = ensureFeishuApiSuccess(
      await client.im.message.reply({
        path: { message_id: replyToMessageId },
        data: {
          content,
          msg_type: "file",
        },
      }),
      "file reply",
    );

    return {
      messageId: extractMessageId(response),
      chatId: receiveId,
    };
  }

  const response = ensureFeishuApiSuccess(
    await client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        content,
        msg_type: "file",
      },
    }),
    "file send",
  );

  return {
    messageId: extractMessageId(response),
    chatId: receiveId,
  };
}

/**
 * Helper to detect file type from extension
 */
export function detectFileType(
  fileName: string,
): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".opus":
    case ".ogg":
      return "opus";
    case ".mp4":
    case ".mov":
    case ".avi":
      return "mp4";
    case ".pdf":
      return "pdf";
    case ".doc":
    case ".docx":
      return "doc";
    case ".xls":
    case ".xlsx":
      return "xls";
    case ".ppt":
    case ".pptx":
      return "ppt";
    default:
      return "stream";
  }
}

/**
 * Check if a string is a local file path (not a URL)
 */
function isLocalPath(urlOrPath: string): boolean {
  // Starts with / or ~ or drive letter (Windows)
  if (urlOrPath.startsWith("/") || urlOrPath.startsWith("~") || /^[a-zA-Z]:/.test(urlOrPath)) {
    return true;
  }
  // Try to parse as URL - if it fails or has no protocol, it's likely a local path
  try {
    const url = new URL(urlOrPath);
    return url.protocol === "file:";
  } catch {
    return true; // Not a valid URL, treat as local path
  }
}

/**
 * Upload and send media (image or file) from URL, local path, or buffer
 */
export async function sendMediaFeishu(params: {
  cfg: MarketBotConfig;
  to: string;
  mediaUrl?: string;
  mediaBuffer?: Buffer;
  fileName?: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, mediaUrl, mediaBuffer, fileName, replyToMessageId } = params;

  let buffer: Buffer;
  let name: string;
  let contentType: string | undefined;

  if (mediaBuffer) {
    buffer = mediaBuffer;
    name = fileName ?? "file";
  } else if (mediaUrl) {
    if (isLocalPath(mediaUrl)) {
      // Local file path - read directly
      const filePath = mediaUrl.startsWith("~")
        ? mediaUrl.replace("~", process.env.HOME ?? "")
        : mediaUrl.replace("file://", "");

      if (!fs.existsSync(filePath)) {
        throw new Error(`Local file not found: ${filePath}`);
      }
      buffer = fs.readFileSync(filePath);
      name = fileName ?? path.basename(filePath);
    } else {
      // Remote URL - fetch
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch media from URL: ${response.status}`);
      }
      contentType = normalizeContentType(response.headers.get("content-type"));
      buffer = Buffer.from(await response.arrayBuffer());
      name = fileName ?? (path.basename(new URL(mediaUrl).pathname) || "file");
    }
  } else {
    throw new Error("Either mediaUrl or mediaBuffer must be provided");
  }

  const isImage = isImageMediaFeishu({
    fileName: name,
    contentType,
    buffer,
  });

  if (isImage) {
    const { imageKey } = await uploadImageFeishu({ cfg, image: buffer });
    return sendImageFeishu({ cfg, to, imageKey, replyToMessageId });
  } else {
    const fileType = detectFileType(name);
    const { fileKey } = await uploadFileFeishu({
      cfg,
      file: buffer,
      fileName: name,
      fileType,
    });
    return sendFileFeishu({ cfg, to, fileKey, replyToMessageId });
  }
}
