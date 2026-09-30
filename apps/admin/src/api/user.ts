import { request } from "./client";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名（邮箱） */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间 */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间 */
    expires: Date;
  };
};

/** 服务端 access token 有效期（与后端 jwt.expiresIn=15m 保持一致） */
const ACCESS_TTL_MS = 15 * 60 * 1000;

/**
 * 登录：自家服务端邮箱密码登录 + 管理员校验
 * 账号即 profiles 表中 is_admin=true 的邮箱用户
 */
export const getLogin = async (data: {
  username: string;
  password: string;
}): Promise<UserResult> => {
  let res: any;
  try {
    res = await request("post", "/auth/login", undefined, {
      email: data.username.trim(),
      password: data.password
    });
  } catch (e: any) {
    throw new Error(e?.message || "邮箱或密码错误");
  }

  const { accessToken, refreshToken, user } = res ?? {};
  if (!user?.isAdmin) {
    throw new Error("该账号不是管理员，无权进入管理后台");
  }

  return {
    success: true,
    data: {
      avatar: user.avatar ?? "",
      username: data.username.trim(),
      nickname: user.nickname || data.username.trim(),
      roles: ["admin"],
      permissions: ["*:*:*"],
      accessToken,
      refreshToken,
      expires: new Date(Date.now() + ACCESS_TTL_MS)
    }
  };
};

/** 刷新`token`（轮换：旧 refresh 作废，返回新的一对） */
export const refreshTokenApi = async (data?: {
  refreshToken: string;
}): Promise<RefreshTokenResult> => {
  let res: any;
  try {
    res = await request("post", "/auth/refresh", undefined, {
      refreshToken: data?.refreshToken
    });
  } catch (e: any) {
    throw new Error(e?.message || "登录已过期，请重新登录");
  }
  return {
    success: true,
    data: {
      accessToken: res?.accessToken,
      refreshToken: res?.refreshToken,
      expires: new Date(Date.now() + ACCESS_TTL_MS)
    }
  };
};
