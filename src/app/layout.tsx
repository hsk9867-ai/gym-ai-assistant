import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "헬스장 AI 경영비서",
  description: "회원·매출·재등록을 자동 분석하고 관장에게 먼저 보고하는 헬스장 경영비서 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
