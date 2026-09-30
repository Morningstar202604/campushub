import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CreateCommentDto } from './dto/comments.dto.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller()
@ApiTags('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:id/comments')
  listForPost(@Param('id') id: string) {
    return this.comments.list('post', id);
  }

  @Get('products/:id/comments')
  listForProduct(@Param('id') id: string) {
    return this.comments.list('product', id);
  }

  @Post('posts/:id/comments')
  @UseGuards(AuthGuard)
  createForPost(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.sub, 'post', id, dto);
  }

  @Post('products/:id/comments')
  @UseGuards(AuthGuard)
  createForProduct(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.sub, 'product', id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  softDelete(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.comments.softDelete(user.sub, id);
  }
}
