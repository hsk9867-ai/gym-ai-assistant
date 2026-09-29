/**
 * 데모 센터 + 샘플 데이터 시드.
 * 실행: npm run db:seed  (기존 데모 센터가 있으면 삭제 후 재생성)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { preparePhone, randomToken } from "../src/lib/crypto";

const prisma = new PrismaClient();

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const GIVEN = ["민준", "서연", "도윤", "지우", "하은", "예준", "수아", "시우", "지민", "하준", "유진", "지호", "채원", "건우", "다은", "현우", "서준", "지아", "은우", "수빈"];

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function ri(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function day(offset: number, base = new Date()) { const d = new Date(base); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }

async function main() {
  // 시드 재실행 안전성: 데모 센터 삭제
  const old = await prisma.center.findFirst({ where: { name: "데모 피트니스" } });
  if (old) {
    await prisma.user.deleteMany({ where: { centerId: old.id } });
    await prisma.center.delete({ where: { id: old.id } });
  }
  await prisma.user.deleteMany({ where: { email: { in: ["admin@demo.gym", "trainer@demo.gym", "super@platform.gym"] } } });

  const center = await prisma.center.create({
    data: { name: "데모 피트니스", phone: "02-123-4567", address: "서울시 강남구 테헤란로 123", plan: "SMART", businessNumber: "123-45-67890", kioskToken: "demo-kiosk", planStatus: "ACTIVE", planRenewsAt: day(20), messageCredits: 30000 },
  });

  const pw = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.create({ data: { centerId: center.id, role: "CENTER_ADMIN", name: "김관장", email: "admin@demo.gym", passwordHash: pw } });
  const trainer = await prisma.user.create({ data: { centerId: center.id, role: "STAFF", name: "박트레이너", email: "trainer@demo.gym", passwordHash: pw, canViewSales: false } });
  await prisma.user.create({ data: { role: "SUPER_ADMIN", name: "플랫폼 운영자", email: "super@platform.gym", passwordHash: pw } });

  const products = await Promise.all([
    prisma.product.create({ data: { centerId: center.id, name: "헬스 1개월", type: "MEMBERSHIP", durationDays: 30, price: 70000 } }),
    prisma.product.create({ data: { centerId: center.id, name: "헬스 3개월", type: "MEMBERSHIP", durationDays: 90, price: 180000 } }),
    prisma.product.create({ data: { centerId: center.id, name: "헬스 6개월", type: "MEMBERSHIP", durationDays: 180, price: 300000 } }),
    prisma.product.create({ data: { centerId: center.id, name: "헬스 12개월", type: "MEMBERSHIP", durationDays: 365, price: 480000 } }),
    prisma.product.create({ data: { centerId: center.id, name: "PT 10회", type: "PT", ptCount: 10, price: 600000 } }),
    prisma.product.create({ data: { centerId: center.id, name: "PT 20회", type: "PT", ptCount: 20, price: 1100000 } }),
  ]);
  const msProducts = products.filter((p) => p.type === "MEMBERSHIP");
  const ptProducts = products.filter((p) => p.type === "PT");

  const REASONS = ["PRICE", "PRICE", "PRICE", "TIME", "TIME", "FACILITY", "TRAINER", "DISTANCE", "OTHER_GYM", "ETC"];
  const FEEDBACKS = ["샤워실 온수가 자주 끊겨요", "저녁 7시에 기구 대기가 너무 길어요", "락커 요금이 부담됩니다", "스트레칭 존이 더 넓었으면 좋겠어요", "PT 가격이 다른 곳보다 비싸요", "주차가 불편해요"];

  for (let i = 0; i < 60; i++) {
    const name = rnd(SURNAMES) + rnd(GIVEN);
    const phone = `010${String(2000 + i).padStart(4, "0")}${String(ri(1000, 9999))}`;
    const joinedOffset = -ri(20, 400);
    const member = await prisma.member.create({
      data: {
        centerId: center.id, name, ...preparePhone(phone), gender: Math.random() > 0.5 ? "M" : "F",
        joinedAt: day(joinedOffset), staffId: Math.random() > 0.5 ? trainer.id : admin.id,
        smsAdConsent: Math.random() > 0.4, kakaoAdConsent: Math.random() > 0.3, consentAt: day(joinedOffset), surveyToken: randomToken(),
      },
    });

    // 회원권 이력: 첫 회원권(가입일 시작) + 경우에 따라 재등록
    const first = rnd(msProducts);
    const firstStart = day(joinedOffset);
    const firstEnd = day(joinedOffset + (first.durationDays ?? 30) - 1);
    const firstMs = await prisma.membership.create({
      data: { centerId: center.id, memberId: member.id, productId: first.id, productName: first.name, startDate: firstStart, endDate: firstEnd, amount: first.price, status: firstEnd < new Date() ? "EXPIRED" : "ACTIVE", createdAt: firstStart },
    });
    await prisma.payment.create({ data: { centerId: center.id, memberId: member.id, membershipId: firstMs.id, productName: first.name, amount: first.price, type: "NEW", method: rnd(["CARD", "CARD", "CASH", "TRANSFER"]), paidAt: firstStart, salespersonId: rnd([admin.id, trainer.id]) } });

    let lastEnd = firstEnd;
    if (firstEnd < new Date()) {
      // 만료됨 → 60% 재등록, 40% 미재등록
      if (Math.random() < 0.6) {
        const p = rnd(msProducts);
        const start = day(1, firstEnd);
        const end = day((p.durationDays ?? 30) - 1, start);
        const ms = await prisma.membership.create({
          data: { centerId: center.id, memberId: member.id, productId: p.id, productName: p.name, startDate: start, endDate: end, amount: p.price, isRenewal: true, status: end < new Date() ? "EXPIRED" : "ACTIVE", createdAt: start },
        });
        await prisma.payment.create({ data: { centerId: center.id, memberId: member.id, membershipId: ms.id, productName: p.name, amount: p.price, type: "RENEWAL", method: "CARD", paidAt: start, salespersonId: admin.id } });
        await prisma.renewal.create({ data: { centerId: center.id, memberId: member.id, membershipId: firstMs.id, status: "RENEWED", answeredAt: start, answeredBy: "STAFF" } });
        lastEnd = end;
      } else {
        const answered = Math.random() < 0.55;
        await prisma.renewal.create({
          data: {
            centerId: center.id, memberId: member.id, membershipId: firstMs.id, status: "NOT_RENEWED",
            reason: answered ? rnd(REASONS) : null, feedback: answered && Math.random() < 0.5 ? rnd(FEEDBACKS) : null,
            answeredAt: answered ? day(2, firstEnd) : null, answeredBy: answered ? (Math.random() < 0.6 ? "MEMBER" : "STAFF") : null, contactedAt: day(-3, firstEnd),
          },
        });
      }
    }

    // PT 패키지 (35%)
    if (Math.random() < 0.35) {
      const p = rnd(ptProducts);
      const used = ri(0, p.ptCount ?? 10);
      const pkg = await prisma.ptPackage.create({ data: { centerId: center.id, memberId: member.id, productId: p.id, productName: p.name, totalCount: p.ptCount ?? 10, usedCount: used, amount: p.price, trainerId: trainer.id } });
      await prisma.payment.create({ data: { centerId: center.id, memberId: member.id, ptPackageId: pkg.id, productName: p.name, amount: p.price, type: "PT", method: "CARD", paidAt: day(ri(-60, -1)), salespersonId: trainer.id } });
      for (let k = 0; k < used; k++) await prisma.ptSession.create({ data: { centerId: center.id, ptPackageId: pkg.id, memberId: member.id, trainerId: trainer.id, usedAt: day(-ri(1, 50)) } });
    }

    // 출석: 활성 회원은 최근 30일 내 여러 번, 일부는 장기 미방문
    if (lastEnd >= new Date()) {
      const dormant = Math.random() < 0.15;
      const visits = dormant ? 0 : ri(3, 14);
      let last: Date | null = null;
      for (let k = 0; k < visits; k++) {
        const at = day(-ri(0, 28));
        at.setHours(ri(7, 21), ri(0, 59));
        await prisma.attendance.create({ data: { centerId: center.id, memberId: member.id, checkedAt: at } });
        if (!last || at > last) last = at;
      }
      if (dormant) last = day(-ri(35, 70));
      await prisma.member.update({ where: { id: member.id }, data: { lastVisitAt: last } });
    } else {
      await prisma.member.update({ where: { id: member.id }, data: { lastVisitAt: day(-ri(0, 10), lastEnd) } });
    }
  }

  // 오늘 매출/방문이 보이도록 오늘 데이터 몇 건
  const todayMembers = await prisma.member.findMany({ where: { centerId: center.id }, take: 5, orderBy: { createdAt: "asc" } });
  for (const m of todayMembers) {
    const at = new Date(); at.setHours(ri(7, 12), ri(0, 59));
    await prisma.attendance.create({ data: { centerId: center.id, memberId: m.id, checkedAt: at } });
  }
  await prisma.payment.create({ data: { centerId: center.id, memberId: todayMembers[0].id, productName: "락커 3개월", amount: 30000, type: "ETC", method: "CASH", salespersonId: admin.id } });

  const counts = await Promise.all([prisma.member.count({ where: { centerId: center.id } }), prisma.membership.count({ where: { centerId: center.id } }), prisma.payment.count({ where: { centerId: center.id } })]);
  console.log(`✔ 데모 센터 생성: 회원 ${counts[0]}명, 회원권 ${counts[1]}건, 결제 ${counts[2]}건`);
  console.log("  센터관리자: admin@demo.gym / demo1234");
  console.log("  트레이너 : trainer@demo.gym / demo1234");
  console.log("  슈퍼관리자: super@platform.gym / demo1234");
}

main().finally(() => prisma.$disconnect());
