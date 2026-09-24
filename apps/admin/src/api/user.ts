import { supabase } from "./supabase";

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
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
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
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

/**
 * 登录：Supabase 邮箱密码登录 + 管理员校验
 * 账号即 profiles 表中 is_admin=true 的邮箱用户
 */
export const getLogin = async (data: {
  username: string;
  password: string;
}): Promise<UserResult> => {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.username.trim(),
    password: data.password
  });
  if (error) throw new Error(error.message || "邮箱或密码错误");
  if (!authData.session) throw new Error("登录失败，请重试");

  // 管理员校验：profiles.is_admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nickname, avatar, is_admin")
    .eq("id", authData.user.id)
    .single();
  if (profileError) throw new Error("账号信息读取失败");
  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    throw new Error("该账号不是管理员，无权进入管理后台");
  }

  return {
    success: true,
    data: {
      avatar: profile.avatar ?? "",
      username: data.username.trim(),
      nickname: profile.nickname || data.username.trim(),
      roles: ["admin"],
      permissions: ["*:*:*"],
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expires: new Date(authData.session.expires_at * 1000)
    }
  };
};

/** 刷新`token` */
export const refreshTokenApi = async (data?: {
  refreshToken: string;
}): Promise<RefreshTokenResult> => {
  const { data: sessionData, error } = await supabase.auth.refreshSession({
    refresh_token: data?.refreshToken
  });
  if (error) throw new Error(error.message || "登录已过期，请重新登录");
  if (!sessionData.session) throw new Error("登录已过期，请重新登录");
  return {
    success: true,
    data: {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      expires: new Date(sessionData.session.expires_at * 1000)
    }
  };
};
