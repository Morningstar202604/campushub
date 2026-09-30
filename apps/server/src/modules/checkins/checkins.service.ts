import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000; // Asia/Shanghai = UTC+8，无夏令时

/** 上海时区的日期字符串 YYYY-MM-DD（基准 nowMs 可偏移用于取昨天） */
function shanghaiDateStr(nowMs = Date.now()): string {
  const t = new Date(nowMs + SHANGHAI_OFFSET_MS);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' 转 Prisma date 值（PG date 列按 UTC 日期存取，保持一致） */
function toDateValue(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 每日签到：streak 断签重置，每连续 7 天额外 +5 积分 */
  async checkin(userId: string) {
    const today = shanghaiDateStr();
    const yesterday = shanghaiDateStr(Date.now() - 86_400_000);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existed = await tx.checkin.findUnique({
          where: { userId_date: { userId, date: toDateValue(today) } },
          select: { id: true },
        });
        if (existed) {
          throw new BadRequestException('今天已经签到过了');
        }

        const profile = await tx.profile.findUnique({
          where: { id: userId },
          select: { checkinStreak: true, lastCheckinDate: true },
        });
        if (!profile) throw new NotFoundException('用户不存在');

        // 昨天签过 → 连续 +1；否则断签重置
        const lastDate = profile.lastCheckinDate
          ? profile.lastCheckinDate.toISOString().slice(0, 10)
          : null;
        const newStreak = lastDate === yesterday ? (profile.checkinStreak ?? 0) + 1 : 1;
        // 与原生 RPC 一致：1 + floor(streak/7)*5，第 7/14/21... 天额外 +5
        const points = 1 + Math.floor(newStreak / 7) * 5;

        await tx.checkin.create({
          data: {
            userId,
            date: toDateValue(today),
            streak: newStreak,
            points,
          },
        });
        await tx.profile.update({
          where: { id: userId },
          data: {
            checkinStreak: newStreak,
            lastCheckinDate: toDateValue(today),
            points: { increment: points },
          },
        });

        return { date: today, streak: newStreak, points };
      });
    } catch (e) {
      // 并发双签：唯一约束 (user_id, date) 冲突 → 同样视为已签到
      if (
        e instanceof BadRequestException
      ) throw e;
      if ((e as { code?: string }).code === 'P2002') {
        throw new BadRequestException('今天已经签到过了');
      }
      throw e;
    }
  }

  /** 我的签到历史（日期倒序） */
  async myCheckins(userId: string, limit = 30) {
    return this.prisma.checkin.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      select: {
        date: true,
        streak: true,
        points: true,
        createdAt: true,
      },
    });
  }
}
