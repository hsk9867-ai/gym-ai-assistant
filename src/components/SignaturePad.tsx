"use client";

import { useEffect, useRef, useState } from "react";

/** 마우스/터치 전자서명 패드. hidden input(name)에 PNG data URL을 넣는다. */
export function SignaturePad({ name = "signature" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = 200 * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (inputRef.current) inputRef.current.value = canvasRef.current!.toDataURL("image/png");
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (inputRef.current) inputRef.current.value = "";
    setHasInk(false);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-[200px] w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <input ref={inputRef} type="hidden" name={name} />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{hasInk ? "서명이 입력되었습니다." : "위 영역에 손가락 또는 마우스로 서명하세요."}</span>
        <button type="button" onClick={clear} className="underline hover:text-gray-900">지우기</button>
      </div>
    </div>
  );
}
