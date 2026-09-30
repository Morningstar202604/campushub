import { describe, expect, it } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckinsService } from './checkins.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * 核心单测：签到防重、连续/断签、积分规则（与旧 Supabase RPC 口径一致）。
 * PrismaService 用内存 mock，只验证服务层规则，不连数据库。
 */
function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const tx = {
    checkin: {
      findUnique: overrides.findUnique ?? (async () => null),
      create: overrides.create ?? (async () => ({})),
    },
    profile: {
      findUnique: overrides.profileFind ?? (async () => null),
      update: overrides.profileUpdate ?? (async () => ({})),
    },
  };
  const prisma = {
    $transaction: overrides.$transaction
      ? overrides.$transaction
      : async (fn: (t: typeof tx) => unknown) => fn(tx),
    checkin: { findMany: overrides.findMany ?? (async () => []) },
  } as unknown as PrismaService;
  return new CheckinsService(prisma);
}

describe('CheckinsService.checkin', () => {
  it('今天已签到 → 抛 BadRequest（防重）', async () => {
    const svc = makeService({
      findUnique: async () => ({ id: 'c1' }),
    });
    await expect(svc.checkin('u1')).rejects.toThrow(BadRequestException);
  });

  it('昨天签过 → streak 连续 +1，积分 = 1 + floor(streak/7)*5', async () => {
    // 昨天 = 今天 - 1 天（上海时区口径）
    const yesterday = new Date(
      Date.now() - 86_400_000 + 8 * 3600 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const svc = makeService({
      profileFind: async () => ({
        checkinStreak: 3,
        lastCheckinDate: new Date(`${yesterday}T00:00:00.000Z`),
      }),
    });
    const res = await svc.checkin('u1');
    expect(res.streak).toBe(4);
    expect(res.points).toBe(1); // floor(4/7)=0
  });

  it('昨天没签 → 断签重置 streak=1', async () => {
    const svc = makeService({
      profileFind: async () => ({
        checkinStreak: 12,
        lastCheckinDate: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });
    const res = await svc.checkin('u1');
    expect(res.streak).toBe(1);
    expect(res.points).toBe(1);
  });

  it('第 7 天 → 额外 +5 积分（1 + floor(7/7)*5 = 6）', async () => {
    const yesterday = new Date(
      Date.now() - 86_400_000 + 8 * 3600 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const svc = makeService({
      profileFind: async () => ({
        checkinStreak: 6,
        lastCheckinDate: new Date(`${yesterday}T00:00:00.000Z`),
      }),
    });
    const res = await svc.checkin('u1');
    expect(res.streak).toBe(7);
    expect(res.points).toBe(6);
  });

  it('用户不存在 → NotFound', async () => {
    const svc = makeService({
      profileFind: async () => null,
    });
    await expect(svc.checkin('nobody')).rejects.toThrow(NotFoundException);
  });
});
