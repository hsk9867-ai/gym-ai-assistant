export const won = (n: number | null | undefined) =>
  `${(n ?? 0).toLocaleString("ko-KR")}원`;

export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("ko-KR");

export const pct = (part: number, total: number) =>
  total === 0 ? "0%" : `${Math.round((part / total) * 1000) / 10}%`;

export function ymd(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ymdhm(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${ymd(date)} ${hh}:${mm}`;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function parseDateInput(v: FormDataEntryValue | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const MEMBER_STATUS: Record<string, string> = {
  ACTIVE: "정상",
  EXPIRING: "만료예정",
  EXPIRED: "만료",
  PAUSED: "휴회",
  DORMANT: "장기미방문",
  WITHDRAWN: "탈퇴",
};

export const RENEWAL_STATUS: Record<string, string> = {
  UNCONFIRMED: "미확인",
  PLANNED: "재등록 예정",
  RENEWED: "재등록 완료",
  NOT_RENEWED: "미재등록",
  UNREACHABLE: "연락불가",
};

export const RENEWAL_REASON: Record<string, string> = {
  PRICE: "가격 부담",
  TIME: "시간이 부족함",
  OTHER_GYM: "다른 센터 이용",
  DISTANCE: "거리/이사",
  FACILITY: "시설 불만",
  TRAINER: "트레이너 관련",
  PROGRAM: "프로그램 부족",
  GOAL_DONE: "운동목표 달성",
  ETC: "기타",
};

export const PAYMENT_TYPE: Record<string, string> = {
  NEW: "신규",
  RENEWAL: "재등록",
  PT: "PT",
  ETC: "기타",
};

export const PAYMENT_METHOD: Record<string, string> = {
  CARD: "카드",
  CASH: "현금",
  TRANSFER: "계좌이체",
  ETC: "기타",
};

export const CONTRACT_STATUS: Record<string, string> = {
  DRAFT: "작성중",
  SENT: "서명대기",
  SIGNED: "서명완료",
  CANCELLED: "취소",
};

export const MESSAGE_STATUS: Record<string, string> = {
  QUEUED: "대기",
  SENT: "발송완료",
  SIMULATED: "시뮬레이션",
  FAILED: "실패",
  SKIPPED: "미발송(동의없음)",
};

export const PLAN_LABEL: Record<string, string> = {
  BASIC: "BASIC",
  SMART: "SMART",
  AI_PRO: "AI PRO",
};

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "슈퍼관리자",
  CENTER_ADMIN: "센터관리자",
  STAFF: "직원",
};
