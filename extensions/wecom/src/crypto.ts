import crypto from "node:crypto";

function pkcs7Pad(buf: Buffer, blockSize = 32): Buffer {
  const pad = blockSize - (buf.length % blockSize || blockSize);
  const padding = Buffer.alloc(pad, pad);
  return Buffer.concat([buf, padding]);
}

function pkcs7Unpad(buf: Buffer, blockSize = 32): Buffer {
  if (buf.length === 0 || buf.length % blockSize !== 0) {
    throw new Error("invalid PKCS7 padding (length)");
  }
  const pad = buf[buf.length - 1] ?? 0;
  if (pad <= 0 || pad > blockSize) {
    throw new Error("invalid PKCS7 padding (value)");
  }
  for (let i = buf.length - pad; i < buf.length; i += 1) {
    if (buf[i] !== pad) throw new Error("invalid PKCS7 padding (bytes)");
  }
  return buf.subarray(0, buf.length - pad);
}

function decodeAesKey(encodingAesKey: string): Buffer {
  const trimmed = encodingAesKey.trim();
  // WeCom encodingAesKey is base64 without trailing '='.
  const key = Buffer.from(`${trimmed}=`, "base64");
  if (key.length !== 32) {
    throw new Error(`invalid encodingAesKey (expected 32 bytes, got ${key.length})`);
  }
  return key;
}

function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function writeUInt32BE(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value, 0);
  return out;
}

export function wecomSignature(params: {
  token: string;
  timestamp: string;
  nonce: string;
  encrypt: string;
}): string {
  const items = [params.token, params.timestamp, params.nonce, params.encrypt].sort();
  return crypto.createHash("sha1").update(items.join("")).digest("hex");
}

export function wecomEncrypt(params: {
  encodingAesKey: string;
  corpId: string;
  plaintextXml: string;
}): string {
  const aesKey = decodeAesKey(params.encodingAesKey);
  const iv = aesKey.subarray(0, 16);
  const random16 = crypto.randomBytes(16);
  const xmlBuf = Buffer.from(params.plaintextXml, "utf8");
  const corpBuf = Buffer.from(params.corpId, "utf8");
  const msgLen = writeUInt32BE(xmlBuf.length);
  const raw = Buffer.concat([random16, msgLen, xmlBuf, corpBuf]);
  const padded = pkcs7Pad(raw);

  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  return encrypted.toString("base64");
}

export function wecomDecrypt(params: {
  encodingAesKey: string;
  corpId: string;
  encrypt: string;
}): { plaintextXml: string } {
  const aesKey = decodeAesKey(params.encodingAesKey);
  const iv = aesKey.subarray(0, 16);
  const encrypted = Buffer.from(params.encrypt, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const raw = pkcs7Unpad(padded);
  if (raw.length < 16 + 4) throw new Error("invalid decrypted payload (too short)");

  const msgLen = readUInt32BE(raw, 16);
  const xmlStart = 16 + 4;
  const xmlEnd = xmlStart + msgLen;
  if (xmlEnd > raw.length) throw new Error("invalid decrypted payload (length)");
  const plaintextXml = raw.subarray(xmlStart, xmlEnd).toString("utf8");
  const corp = raw.subarray(xmlEnd).toString("utf8");
  if (corp !== params.corpId) {
    throw new Error("invalid corpId in decrypted payload");
  }
  return { plaintextXml };
}

