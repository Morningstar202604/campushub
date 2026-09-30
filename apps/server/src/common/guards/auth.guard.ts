import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * 登录守卫（真实实现）：验证 JWT → 把 { sub: userId } 写入 req.user
 * 在需要登录的路由上 @UseGuards(AuthGuard)，配合 @CurrentUser() 取用户
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('请先登录');
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException('请先登录');
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      (req as { user?: unknown }).user = { sub: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
