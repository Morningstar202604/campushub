import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthedUser) {
    return this.auth.me(user.sub);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateProfile(@CurrentUser() user: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: AuthedUser) {
    return this.auth.logout(user.sub);
  }
}
