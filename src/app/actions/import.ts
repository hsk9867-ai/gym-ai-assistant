"use server";

import { revalidatePath } from "next/cache";
import { requireCenterSession } from "@/lib/auth";
import { buildPreview, guessMapping, parseSheet, runImport, type DupPolicy, type Mapping, type ParsedSheet, type PreviewRow } from "@/lib/services/import";

export async function parseUploadAction(formData: FormData): Promise<{ error?: string; fileName?: string; sheet?: ParsedSheet; mapping?: Mapping }> {
  await requireCenterSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 선택하세요." };
  if (file.size > 10 * 1024 * 1024) return { error: "10MB 이하 파일만 업로드할 수 있습니다." };
  const buf = Buffer.from(await file.arrayBuffer());
  let sheet: ParsedSheet;
  try {
    sheet = parseSheet(buf, file.name);
  } catch {
    return { error: "파일을 읽을 수 없습니다. CSV 또는 Excel(xlsx) 파일인지 확인하세요." };
  }
  if (!sheet.headers.length || !sheet.rows.length) return { error: "데이터가 없습니다. 첫 줄은 컬럼 제목이어야 합니다." };
  if (sheet.rows.length > 5000) return { error: "한 번에 5,000행까지 가져올 수 있습니다." };
  return { fileName: file.name, sheet, mapping: guessMapping(sheet.headers) };
}

export async function previewImportAction(sheet: ParsedSheet, mapping: Mapping): Promise<{ error?: string; rows?: PreviewRow[] }> {
  const s = await requireCenterSession();
  if (mapping.name === undefined || mapping.phone === undefined) return { error: "회원명과 연락처 컬럼은 반드시 지정해야 합니다." };
  const rows = await buildPreview(s.centerId, sheet, mapping);
  return { rows };
}

export async function commitImportAction(fileName: string, sheet: ParsedSheet, mapping: Mapping, policy: DupPolicy) {
  const s = await requireCenterSession();
  const rows = await buildPreview(s.centerId, sheet, mapping);
  const result = await runImport(s.centerId, fileName, rows, policy);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  return result;
}
