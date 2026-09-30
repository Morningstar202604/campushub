import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CreatePostDto, FeedQuery, ReportPostDto, ResolvePostDto } from './dto/posts.dto.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

@Controller('posts')
@ApiTags('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  feed(@Query() q: FeedQuery) {
    return this.posts.feed(q);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  my(@CurrentUser() user: AuthedUser) {
    return this.posts.my(user.sub);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.posts.detail(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.sub, dto);
  }

  @Patch(':id/resolved')
  @UseGuards(AuthGuard)
  resolve(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: ResolvePostDto,
  ) {
    return this.posts.resolve(user.sub, id, dto.resolved);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  softDelete(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.posts.softDelete(user.sub, id);
  }

  @Post(':id/report')
  @UseGuards(AuthGuard)
  report(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.posts.report(user.sub, id, dto);
  }
}
