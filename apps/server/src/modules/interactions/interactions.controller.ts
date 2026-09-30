import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { InteractionsService } from './interactions.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';

type AuthedUser = { sub: string };

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

class StatusQuery {
  @IsIn(['post', 'product'])
  targetType: 'post' | 'product';

  @IsString()
  @IsNotEmpty()
  targetId: string;
}

class FollowDto {
  @IsString()
  @IsNotEmpty()
  followingId: string;
}

class FollowingQuery {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

@Controller()
@ApiTags('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post('posts/:id/like')
  @UseGuards(AuthGuard)
  likePost(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.like(user.sub, 'post', id);
  }

  @Delete('posts/:id/like')
  @UseGuards(AuthGuard)
  unlikePost(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.unlike(user.sub, 'post', id);
  }

  @Post('posts/:id/collect')
  @UseGuards(AuthGuard)
  collectPost(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.collect(user.sub, 'post', id);
  }

  @Delete('posts/:id/collect')
  @UseGuards(AuthGuard)
  uncollectPost(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.uncollect(user.sub, 'post', id);
  }

  @Post('products/:id/like')
  @UseGuards(AuthGuard)
  likeProduct(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.like(user.sub, 'product', id);
  }

  @Delete('products/:id/like')
  @UseGuards(AuthGuard)
  unlikeProduct(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.unlike(user.sub, 'product', id);
  }

  @Post('products/:id/collect')
  @UseGuards(AuthGuard)
  collectProduct(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.collect(user.sub, 'product', id);
  }

  @Delete('products/:id/collect')
  @UseGuards(AuthGuard)
  uncollectProduct(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.interactions.uncollect(user.sub, 'product', id);
  }

  @Get('me/likes')
  @UseGuards(AuthGuard)
  myLikes(@CurrentUser() user: AuthedUser, @Query() q: PageQuery) {
    return this.interactions.myLikes(user.sub, q.page ?? 1, q.pageSize ?? 20);
  }

  @Get('me/collects')
  @UseGuards(AuthGuard)
  myCollects(@CurrentUser() user: AuthedUser, @Query() q: PageQuery) {
    return this.interactions.myCollects(user.sub, q.page ?? 1, q.pageSize ?? 20);
  }

  @Get('interactions/status')
  @UseGuards(AuthGuard)
  status(@CurrentUser() user: AuthedUser, @Query() q: StatusQuery) {
    return this.interactions.status(user.sub, q.targetType, q.targetId);
  }

  @Post('interactions/follow')
  @UseGuards(AuthGuard)
  follow(@CurrentUser() user: AuthedUser, @Body() dto: FollowDto) {
    return this.interactions.follow(user.sub, dto.followingId);
  }

  @Delete('interactions/follow')
  @UseGuards(AuthGuard)
  unfollow(@CurrentUser() user: AuthedUser, @Body() dto: FollowDto) {
    return this.interactions.unfollow(user.sub, dto.followingId);
  }

  @Get('interactions/following')
  @UseGuards(AuthGuard)
  isFollowing(@CurrentUser() user: AuthedUser, @Query() q: FollowingQuery) {
    return this.interactions.isFollowing(user.sub, q.userId);
  }

  @Get('users/:id/follower-count')
  followerCount(@Param('id') id: string) {
    return this.interactions.followerCount(id);
  }
}
