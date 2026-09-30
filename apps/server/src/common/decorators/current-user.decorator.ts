import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 取当前登录用户（由 AuthGuard 写入 req.user）
 *  @CurrentUser() → 整个 user 对象；@CurrentUser('sub') → user.sub */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: Record<string, unknown> }>();
    if (!req.user) return undefined;
    return data ? req.user[data] : req.user;
  },
);
