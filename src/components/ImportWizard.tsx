"use client";

import { useState, useTransition } from "react";
import { commitImportAction, parseUploadAction, previewImportAction } from "@/app/actions/import";
import { IMPORT_FIELDS, type DupPolicy, type Mapping, type ParsedSheet, type PreviewRow } from "@/lib/services/import";
import { Alert, btnCls, btnSecondaryCls, inputCls } from "./ui";
import { ymd } from "@/lib/format";

type Step = 1 | 2 | 3 | 4;

export function ImportWizard() {
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [policy, setPolicy] = useState<DupPolicy>("KEEP");
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; errors: number } | null>(null);
  const [pending, start] = useTransition();

  const upload = (fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await parseUploadAction(fd);
      if (r.error || !r.sheet) return setError(r.error ?? "오류");
      setFileName(r.fileName!);
      setSheet(r.sheet);
      setMapping(r.mapping ?? {});
      setStep(2);
    });

  const doPreview = () =>
    start(async () => {
      setError(null);
      const r = await previewImportAction(sheet!, mapping);
      if (r.error || !r.rows) return setError(r.error ?? "오류");
      setPreview(r.rows);
      setStep(3);
    });

  const doCommit = () =>
    start(async () => {
      setError(null);
      const r = await commitImportAction(fileName, sheet!, mapping, policy);
      setResult(r);
      setStep(4);
    });

  const errCount = preview.filter((p) => p.errors.length).length;
  const dupCount = preview.filter((p) => p.duplicate && !p.errors.length).length;

  return (
    <div className="space-y-5">
      <ol className="flex gap-2 text-xs">
        {["파일 업로드", "컬럼 매칭", "미리보기·오류검사", "완료"].map((t, i) => (
          <li key={t} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-gray-900 text-white" : step > i + 1 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {i + 1}. {t}
          </li>
        ))}
      </ol>

      {error && <Alert>{error}</Alert>}

      {step === 1 && (
        <form action={upload} className="space-y-4">
          <p className="text-sm text-gray-600">
            기존 CRM에서 내보낸 CSV 또는 Excel(xlsx) 파일을 업로드하세요. 첫 줄은 컬럼 제목이어야 합니다.
            <br />권장 컬럼: 이름, 연락처, 회원권 시작일, 회원권 종료일, 상품, 결제금액, PT 잔여, 최근 방문일
          </p>
          <input type="file" name="file" accept=".csv,.xlsx,.xls" required className="block text-sm" />
          <button disabled={pending} className={btnCls}>{pending ? "읽는 중..." : "다음: 컬럼 매칭"}</button>
        </form>
      )}

      {step === 2 && sheet && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">파일 컬럼을 우리 시스템 항목에 연결하세요. 자동으로 추정된 값은 확인 후 수정할 수 있습니다. (총 {sheet.rows.length}행)</p>
          <div className="grid gap-3 md:grid-cols-2">
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 font-medium text-gray-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <select
                  className={inputCls}
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                >
                  <option value="">(사용 안 함)</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>{h || `(${i + 1}열)`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            샘플: {sheet.rows[0]?.map((c, i) => `${sheet.headers[i]}=${c}`).join(" / ")}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className={btnSecondaryCls}>이전</button>
            <button type="button" onClick={doPreview} disabled={pending} className={btnCls}>{pending ? "검사 중..." : "다음: 미리보기"}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>총 <b>{preview.length}</b>행</span>
            <span className="text-red-600">오류 <b>{errCount}</b>행 (건너뜀)</span>
            <span className="text-amber-600">기존 회원과 중복 <b>{dupCount}</b>행</span>
          </div>
          {dupCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="mb-2 font-medium text-amber-800">중복 회원(전화번호 + 센터 기준) 처리 방식</div>
              <div className="flex flex-wrap gap-4">
                {([["KEEP", "기존 데이터 유지"], ["UPDATE", "새 데이터로 갱신"], ["SKIP", "건너뛰기"]] as [DupPolicy, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1"><input type="radio" name="policy" checked={policy === v} onChange={() => setPolicy(v)} />{l}</label>
                ))}
              </div>
            </div>
          )}
          <div className="max-h-96 overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>{["행", "이름", "연락처", "시작", "종료", "상품", "금액", "PT", "최근방문", "상태"].map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((r) => (
                  <tr key={r.index} className={r.errors.length ? "bg-red-50" : r.duplicate ? "bg-amber-50" : ""}>
                    <td className="px-2 py-1">{r.index}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.phone}</td>
                    <td className="px-2 py-1">{ymd(r.membershipStart)}</td>
                    <td className="px-2 py-1">{ymd(r.membershipEnd)}</td>
                    <td className="px-2 py-1">{r.product}</td>
                    <td className="px-2 py-1 tabular-nums">{r.amount.toLocaleString()}</td>
                    <td className="px-2 py-1">{r.ptRemaining || ""}</td>
                    <td className="px-2 py-1">{ymd(r.lastVisit)}</td>
                    <td className="px-2 py-1">{r.errors.length ? <span className="text-red-600">{r.errors.join(", ")}</span> : r.duplicate ? <span className="text-amber-700">중복</span> : <span className="text-emerald-600">신규</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className={btnSecondaryCls}>이전</button>
            <button type="button" onClick={doCommit} disabled={pending || preview.length === errCount} className={btnCls}>{pending ? "가져오는 중..." : "Import 실행"}</button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="space-y-4">
          <Alert kind="success">Import가 완료되었습니다.</Alert>
          <ul className="grid grid-cols-4 gap-3 text-center text-sm">
            <li className="rounded-lg bg-emerald-50 p-3"><div className="text-2xl font-bold text-emerald-700">{result.inserted}</div>신규 등록</li>
            <li className="rounded-lg bg-blue-50 p-3"><div className="text-2xl font-bold text-blue-700">{result.updated}</div>갱신</li>
            <li className="rounded-lg bg-gray-100 p-3"><div className="text-2xl font-bold text-gray-700">{result.skipped}</div>건너뜀</li>
            <li className="rounded-lg bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{result.errors}</div>오류</li>
          </ul>
          <div className="flex gap-2">
            <a href="/members" className={btnCls}>회원 목록 보기</a>
            <button type="button" onClick={() => { setStep(1); setSheet(null); setPreview([]); setResult(null); }} className={btnSecondaryCls}>다른 파일 가져오기</button>
          </div>
        </div>
      )}
    </div>
  );
}
