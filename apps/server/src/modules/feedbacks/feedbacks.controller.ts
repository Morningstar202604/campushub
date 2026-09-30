import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller('feedbacks')
@ApiTags('feedbacks')
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  @Post()
  @UseGuards(AuthGuard)
  submit(@CurrentUser() user: AuthedUser, @Body() dto: CreateFeedbackDto) {
    return this.feedbacks.submit(user.sub, dto);
  }
}
