import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 取当前登录用户（由 AuthGuard 写入 req.user），未登录返回 undefined */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    return req.user;
  },
);
