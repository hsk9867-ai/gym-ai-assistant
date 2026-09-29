import Anthropic from "@anthropic-ai/sdk";

/**
 * AI 문구 생성 (AI PRO).
 * ANTHROPIC_API_KEY 가 있으면 Claude 로 생성, 없으면 템플릿 기반 문구로 대체한다.
 * 기획서 15장 원칙: AI는 센터가 입력한 사실(할인율, 기간, 대상)만 다듬고 가격을 지어내지 않는다.
 */

export type PosterTemplate = "bold" | "fresh" | "minimal";

export interface EventCopy {
  headline: string; // 8~14자, 포스터 대제목
  subheadline: string; // 15~25자
  body: string; // 2~3문장, 카카오/인스타 본문
  cta: string; // 6~12자 행동 유도
  hashtags: string[]; // 3~5개
  palette: [string, string]; // 배경 그라디언트 hex 2색
  accent: string; // 강조색 hex
  template: PosterTemplate;
}

export interface EventInput {
  centerName: string;
  title: string;
  description?: string | null;
  discount?: string | null;
  target?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  tone: string;
}

export function aiMode(): "LIVE" | "TEMPLATE" {
  return process.env.ANTHROPIC_API_KEY ? "LIVE" : "TEMPLATE";
}

const PALETTES: Record<string, { palette: [string, string]; accent: string; template: PosterTemplate }> = {
  energetic: { palette: ["#0f172a", "#1e3a8a"], accent: "#fbbf24", template: "bold" },
  premium: { palette: ["#111111", "#3b2f2f"], accent: "#d4af37", template: "minimal" },
  friendly: { palette: ["#0ea5e9", "#22c55e"], accent: "#ffffff", template: "fresh" },
};

function ymdKo(d?: Date | null) {
  return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
}

/** 키가 없을 때 쓰는 규칙 기반 문구 */
export function templateCopy(input: EventInput): EventCopy {
  const p = PALETTES[input.tone] ?? PALETTES.energetic;
  const period = input.startDate && input.endDate ? `${ymdKo(input.startDate)} ~ ${ymdKo(input.endDate)}` : input.endDate ? `${ymdKo(input.endDate)}까지` : "";
  const discount = input.discount?.trim();
  const target = input.target?.trim();
  // 대제목: 혜택의 첫 구절("+", "·", "/" 앞)이 14자 이내면 사용, 아니면 이벤트명
  const firstClause = discount?.split(/\s*[+·/,]\s*/)[0]?.trim();
  const headline = firstClause && firstClause.length <= 14 ? firstClause : input.title.length <= 14 ? input.title : input.title.slice(0, 13) + "…";
  return {
    headline,
    subheadline: target ? `${target} 대상 특별 혜택` : `${input.centerName} 이벤트`,
    body: [
      `${input.centerName}에서 "${input.title}" 이벤트를 진행합니다.`,
      discount ? `${discount} 혜택을 놓치지 마세요.` : "",
      period ? `기간: ${period}` : "",
      input.description?.trim() ?? "",
    ].filter(Boolean).join(" "),
    cta: "지금 데스크에 문의하세요",
    hashtags: ["#헬스장이벤트", `#${input.centerName.replace(/\s+/g, "")}`, "#재등록혜택", "#운동시작"].slice(0, 4),
    palette: p.palette,
    accent: p.accent,
    template: p.template,
  };
}

export async function generateEventCopy(input: EventInput): Promise<{ copy: EventCopy; source: "AI" | "TEMPLATE"; error?: string }> {
  if (aiMode() === "TEMPLATE") return { copy: templateCopy(input), source: "TEMPLATE" };

  const client = new Anthropic();
  const facts = [
    `센터명: ${input.centerName}`,
    `이벤트명: ${input.title}`,
    input.description ? `설명: ${input.description}` : "",
    input.discount ? `혜택(사실 그대로 사용): ${input.discount}` : "혜택: 명시되지 않음 - 할인율이나 가격을 지어내지 말 것",
    input.target ? `대상: ${input.target}` : "",
    input.startDate || input.endDate ? `기간: ${ymdKo(input.startDate)} ~ ${ymdKo(input.endDate)}` : "",
    `톤: ${input.tone} (energetic=활기찬, premium=고급스러운, friendly=친근한)`,
  ].filter(Boolean).join("\n");

  const system = `당신은 한국 피트니스센터 마케팅 카피라이터입니다. 헬스장 이벤트 홍보 포스터와 카카오톡/인스타그램용 문구를 작성합니다.
규칙:
- 제공된 사실(혜택, 기간, 대상)만 사용하고 가격·할인율을 절대 지어내지 않는다.
- 과장 광고 표현(최고, 1위, 완치 등)과 의학적 효능 주장을 피한다.
- 한국어로 작성하고, 반드시 아래 JSON 형식만 출력한다. 설명 문장이나 코드블록 없이 JSON 객체 하나만 출력한다.
{"headline": "8~14자 대제목", "subheadline": "15~25자 부제", "body": "2~3문장 본문(카카오/인스타용, 이모지 최대 2개)", "cta": "6~12자 행동유도", "hashtags": ["#태그 3~5개"], "palette": ["#hex", "#hex"], "accent": "#hex", "template": "bold|fresh|minimal"}
palette는 톤에 어울리는 어두운→밝은 배경 그라디언트 2색, accent는 그 위에서 잘 보이는 강조색, template는 톤에 맞는 레이아웃을 고른다.`;

  try {
    const res = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: facts }],
    });
    if (res.stop_reason === "refusal") return { copy: templateCopy(input), source: "TEMPLATE", error: "AI가 요청을 거절했습니다." };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const jsonText = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as Partial<EventCopy>;
    const fallback = templateCopy(input);
    const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
    const copy: EventCopy = {
      headline: String(parsed.headline ?? fallback.headline).slice(0, 20),
      subheadline: String(parsed.subheadline ?? fallback.subheadline).slice(0, 40),
      body: String(parsed.body ?? fallback.body).slice(0, 400),
      cta: String(parsed.cta ?? fallback.cta).slice(0, 20),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 5) : fallback.hashtags,
      palette: [hex(parsed.palette?.[0], fallback.palette[0]), hex(parsed.palette?.[1], fallback.palette[1])],
      accent: hex(parsed.accent, fallback.accent),
      template: (["bold", "fresh", "minimal"] as const).includes(parsed.template as PosterTemplate) ? (parsed.template as PosterTemplate) : fallback.template,
    };
    return { copy, source: "AI" };
  } catch (e) {
    const msg = e instanceof Anthropic.AuthenticationError ? "API 키가 올바르지 않습니다."
      : e instanceof Anthropic.RateLimitError ? "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요."
      : e instanceof Anthropic.APIError ? `AI 오류 (${e.status})`
      : e instanceof SyntaxError ? "AI 응답 형식 오류"
      : "AI 호출 실패";
    return { copy: templateCopy(input), source: "TEMPLATE", error: msg };
  }
}
