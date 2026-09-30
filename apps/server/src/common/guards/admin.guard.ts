import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Request } from 'express';

/**
 * 管理员守卫（真实实现，随 admin 模块落地）：
 * 前置 AuthGuard 解析出 req.user.sub（userId）→ 查 profiles.is_admin
 * 非管理员抛 403；用户不存在或已封禁同样拒绝
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('请先登录');

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isBanned: true },
    });
    if (!profile) throw new UnauthorizedException('用户不存在');
    if (profile.isBanned) throw new ForbiddenException('账号已被封禁');
    if (!profile.isAdmin) throw new ForbiddenException('需要管理员权限');

    return true;
  }
}
