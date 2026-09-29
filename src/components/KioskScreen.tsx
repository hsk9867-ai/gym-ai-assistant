"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { kioskCheckInAction, type KioskResult } from "@/app/actions/kiosk";

const RESET_MS = 6000;

export function KioskScreen({ token, centerName }: { token: string; centerName: string }) {
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<KioskResult | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const reset = () => {
    setDigits("");
    setResult(null);
    if (timer.current) clearTimeout(timer.current);
  };

  const submit = (last4: string, memberId?: string) =>
    start(async () => {
      const r = await kioskCheckInAction(token, last4, memberId);
      setResult(r);
      if (r.kind !== "CHOOSE") {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(reset, RESET_MS);
      }
    });

  const press = (k: string) => {
    if (pending || (result && result.kind !== "CHOOSE")) return;
    if (k === "C") return reset();
    if (k === "<") return setDigits((d) => d.slice(0, -1));
    if (digits.length >= 4) return;
    const next = digits + k;
    setDigits(next);
    if (next.length === 4) submit(next);
  };

  // 물리 키보드/바코드 스캐너 입력도 지원
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("<");
      else if (e.key === "Escape") press("C");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tone = result?.kind === "ENTER" ? "bg-emerald-600" : result?.kind === "DENIED" || result?.kind === "NOT_FOUND" ? "bg-red-600" : "bg-gray-900";

  return (
    <div className="flex min-h-screen select-none flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between px-8 py-5 text-gray-400">
        <span className="text-lg font-semibold text-white">{centerName}</span>
        <span className="text-2xl tabular-nums">{clock}</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        {result && result.kind !== "CHOOSE" ? (
          <div className={`w-full max-w-xl rounded-3xl ${tone} p-10 text-center shadow-2xl`} onClick={reset}>
            {result.name && <div className="text-3xl font-bold">{result.name}님</div>}
            <div className="mt-3 text-5xl font-black tracking-tight">{result.title}</div>
            {result.detail && <p className="mt-5 text-xl text-white/85">{result.detail}</p>}
            {result.ok && (
              <div className="mt-6 flex justify-center gap-6 text-lg text-white/80">
                {result.daysLeft !== null && result.daysLeft !== undefined && <span>회원권 D-{result.daysLeft}</span>}
                {result.ptRemaining ? <span>PT 잔여 {result.ptRemaining}회</span> : null}
              </div>
            )}
            <p className="mt-8 text-sm text-white/60">화면을 터치하면 처음으로 돌아갑니다</p>
          </div>
        ) : result?.kind === "CHOOSE" ? (
          <div className="w-full max-w-xl text-center">
            <div className="mb-6 text-3xl font-bold">{result.title}</div>
            <div className="grid grid-cols-2 gap-3">
              {result.candidates?.map((c) => (
                <button key={c.id} onClick={() => submit(digits, c.id)} disabled={pending} className="rounded-2xl bg-gray-800 py-6 text-2xl font-semibold hover:bg-gray-700 active:bg-gray-600">{c.label}</button>
              ))}
            </div>
            <button onClick={reset} className="mt-6 text-gray-400 underline">취소</button>
          </div>
        ) : (
          <>
            <div className="mb-2 text-2xl text-gray-300">휴대폰 번호 뒷 4자리를 입력하세요</div>
            <div className="mb-8 flex gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-20 w-16 items-center justify-center rounded-2xl bg-gray-800 text-5xl font-bold tabular-nums">{digits[i] ?? ""}</div>
              ))}
            </div>
            <div className="grid w-full max-w-xs grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  disabled={pending}
                  className={`h-20 rounded-2xl text-3xl font-semibold active:scale-95 ${k === "C" || k === "<" ? "bg-gray-800 text-gray-300" : "bg-gray-700 hover:bg-gray-600"}`}
                >
                  {k === "<" ? "⌫" : k === "C" ? "지움" : k}
                </button>
              ))}
            </div>
            {pending && <p className="mt-6 text-gray-400">확인 중...</p>}
          </>
        )}
      </main>
      <footer className="px-8 py-4 text-center text-xs text-gray-600">회원권이 만료되었거나 등록되지 않은 경우 데스크에 문의해 주세요.</footer>
    </div>
  );
}
