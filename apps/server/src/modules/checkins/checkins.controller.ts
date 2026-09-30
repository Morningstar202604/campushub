import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CheckinsService } from './checkins.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller('checkins')
@ApiTags('checkins')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post()
  @UseGuards(AuthGuard)
  checkin(@CurrentUser() user: AuthedUser) {
    return this.checkins.checkin(user.sub);
  }

  @Get()
  @UseGuards(AuthGuard)
  my(@CurrentUser() user: AuthedUser, @Query('limit') limit?: string) {
    return this.checkins.myCheckins(user.sub, Number(limit) || 30);
  }
}
