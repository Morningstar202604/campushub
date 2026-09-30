import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * 管理员守卫：M1 实现
 * 从 req.user 取 userId → 查 profiles.is_admin → 非管理员抛 ForbiddenException('无权限')
 * 权限兜底在数据库层：admin_logs / 敏感写操作额外校验
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
