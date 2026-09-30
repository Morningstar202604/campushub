import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

type ProfileBrief = {
  nickname: string;
  avatar: string;
  isAdmin: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** 注册：同事务创建 User + Profile（id 1:1） */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('该邮箱已注册，请直接登录');

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction([
      this.prisma.user.create({
        data: { id, email: dto.email, passwordHash },
      }),
      this.prisma.profile.create({ data: { id, nickname: dto.nickname } }),
    ]);
    // 注册即登录：直接签发 token 对，前端无需二次登录
    return this.issueTokens(id, {
      nickname: dto.nickname,
      avatar: '',
      isAdmin: false,
    });
  }

  /** 登录：校验密码 → 签发 token 对 + 存 refresh 会话 */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.profile?.isBanned) {
      throw new UnauthorizedException('账号已被封禁');
    }
    return this.issueTokens(user.id, user.profile);
  }

  /** 刷新：校验旧 refresh → 作废旧会话 → 换发新 token 对（轮换） */
  async refresh(dto: RefreshDto) {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashToken(dto.refreshToken) },
      include: { user: { include: { profile: true } } },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
    await this.prisma.refreshSession.delete({ where: { id: session.id } });
    return this.issueTokens(session.userId, session.user.profile);
  }

  /** 当前用户 profile */
  async me(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new UnauthorizedException('账号不存在');
    return profile;
  }

  /** 更新个人资料：只更新传入的字段 */
  async updateProfile(userId: string, patch: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!profile) throw new UnauthorizedException('账号不存在');
    return this.prisma.profile.update({
      where: { id: userId },
      data: patch,
    });
  }

  /** 注销：作废该用户全部 refresh 会话 */
  async logout(userId: string) {
    await this.prisma.refreshSession.deleteMany({ where: { userId } });
    return { ok: true };
  }

  private async issueTokens(
    userId: string,
    profile?: ProfileBrief | null,
  ) {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    // refresh token 用两个 uuid 拼 128bit 随机，库里只存 sha256 摘要
    const refreshToken = randomUUID() + randomUUID();
    const ttlDays = this.config.get<number>('refreshTtlDays') ?? 30;
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        nickname: profile?.nickname ?? '',
        avatar: profile?.avatar ?? '',
        isAdmin: profile?.isAdmin ?? false,
      },
    };
  }
}
