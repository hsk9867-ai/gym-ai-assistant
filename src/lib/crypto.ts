import crypto from "node:crypto";

// 전화번호는 암호화 저장 + 해시로 검색/중복검사한다.
function key(): Buffer {
  const raw = process.env.PHONE_ENC_KEY ?? "dev-phone-encryption-key";
  return crypto.createHash("sha256").update(raw).digest();
}

export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  // 010-1234-5678 / 01012345678 / +82 10 1234 5678 모두 01012345678 로 정규화
  if (digits.startsWith("82") && digits.length >= 11) return "0" + digits.slice(2);
  // Excel 숫자 셀에서 선행 0이 빠진 경우 (1012345678 → 01012345678)
  if (digits.length === 10 && digits.startsWith("1")) return "0" + digits;
  return digits;
}

export function formatPhone(digits: string): string {
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

export function hashPhone(digits: string): string {
  return crypto.createHmac("sha256", key()).update(digits).digest("hex");
}

export function encryptPhone(digits: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptPhone(payload: string): string {
  try {
    const [ivB, tagB, encB] = payload.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function preparePhone(input: string) {
  const digits = normalizePhone(input);
  return {
    phoneEncrypted: encryptPhone(digits),
    phoneHash: hashPhone(digits),
    phoneLast4: digits.slice(-4),
  };
}

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
