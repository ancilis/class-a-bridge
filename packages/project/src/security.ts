const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
// Explicit control-character matching is required for safe filenames and CSVs.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/gu;
// eslint-disable-next-line no-control-regex
const CSV_FORMULA_PREFIX = /^[\s\u0000-\u001f]*[=+\-@]/u;

// Web Crypto deliberately accepts ArrayBuffer-backed views, not views that
// could reference a SharedArrayBuffer. Copying also prevents caller mutation
// while an asynchronous cryptographic operation is in progress.
const cryptoBytes = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
};

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", cryptoBytes(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeFilename(input: string, fallback = "class-a-bridge-file"): string {
  const leaf = input.normalize("NFKC").split(/[\\/]/u).pop() ?? "";
  const sanitized = leaf
    .replace(CONTROL_CHARACTERS, "")
    .replace(/[:*?"<>|]/gu, (character) => (character === ":" ? "-" : ""))
    .replace(/\s+/gu, " ")
    .replace(/^\.+|\.+$/gu, "")
    .trim()
    .slice(0, 180);
  return sanitized || fallback;
}

export function csvCell(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const safe = CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

interface EncryptedEnvelope {
  readonly magic: "CLASSABRIDGE-ENC";
  readonly version: 1;
  readonly algorithm: "AES-256-GCM";
  readonly kdf: "PBKDF2-HMAC-SHA-256";
  readonly iterations: number;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
}

const MIN_PBKDF2_ITERATIONS = 10_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const MAX_ENCRYPTED_ENVELOPE_BYTES = 150 * 1024 * 1024;

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: cryptoBytes(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBundle(
  plaintext: Uint8Array,
  password: string,
  options: { readonly iterations?: number } = {},
): Promise<Uint8Array> {
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const iterations = options.iterations ?? 310_000;
  if (iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error("The cryptographic work factor is outside the supported range.");
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode("CLASSABRIDGE-ENC:1") },
    key,
    cryptoBytes(plaintext),
  );
  const envelope: EncryptedEnvelope = {
    magic: "CLASSABRIDGE-ENC",
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-HMAC-SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return textEncoder.encode(JSON.stringify(envelope));
}

export async function decryptBundle(encrypted: Uint8Array, password: string): Promise<Uint8Array> {
  try {
    if (encrypted.byteLength > MAX_ENCRYPTED_ENVELOPE_BYTES) throw new Error("Envelope too large");
    const parsed = JSON.parse(textDecoder.decode(encrypted)) as Partial<EncryptedEnvelope>;
    if (
      parsed.magic !== "CLASSABRIDGE-ENC" ||
      parsed.version !== 1 ||
      parsed.algorithm !== "AES-256-GCM" ||
      parsed.kdf !== "PBKDF2-HMAC-SHA-256" ||
      typeof parsed.iterations !== "number" ||
      !Number.isInteger(parsed.iterations) ||
      parsed.iterations < MIN_PBKDF2_ITERATIONS ||
      parsed.iterations > MAX_PBKDF2_ITERATIONS ||
      typeof parsed.salt !== "string" ||
      parsed.salt.length > 64 ||
      typeof parsed.iv !== "string" ||
      parsed.iv.length > 64 ||
      typeof parsed.ciphertext !== "string"
    ) {
      throw new Error("Invalid envelope");
    }
    const salt = base64ToBytes(parsed.salt);
    const iv = base64ToBytes(parsed.iv);
    const key = await deriveKey(password, salt, parsed.iterations);
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: cryptoBytes(iv),
        additionalData: textEncoder.encode("CLASSABRIDGE-ENC:1"),
      },
      key,
      cryptoBytes(base64ToBytes(parsed.ciphertext)),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error("Unable to decrypt project bundle. Check the password and file integrity.");
  }
}
