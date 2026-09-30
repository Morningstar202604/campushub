import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const POST_KINDS = ['post', 'task', 'lost', 'found', 'confession'] as const;

export class CreatePostDto {
  // 分类 id 为固定可读文本（cat_idle 等，见 seed.sql），非 UUID
  @IsString()
  @ApiProperty({ description: 'categoryId', required: true, type: String })
  categoryId!: string;

  @IsIn(POST_KINDS, { message: '帖子类型不正确' })
  @ApiProperty({ description: 'kind', required: true, type: String })
  kind!: (typeof POST_KINDS)[number];

  @IsString()
  @ApiProperty({ description: 'title', required: true, type: String })
  title!: string;

  @IsString()
  @ApiProperty({ description: 'content?', required: false, type: String })
  content?: string;

  @IsOptional()
  @ApiProperty({ description: 'images?', required: false, type: [String] })
  images?: string[];

  @IsOptional()
  @ApiProperty({ description: 'tags?', required: false, type: [String] })
  tags?: string[];

  @IsOptional()
  @ApiProperty({ description: 'location?', required: false, type: String })
  location?: string;

  @IsOptional()
  @ApiProperty({ description: 'isAnonymous?', required: false, type: Boolean })
  isAnonymous?: boolean;

  @IsOptional()
  @ApiProperty({ description: 'expireAt?', required: false, type: String, nullable: true })
  expireAt?: string;
}

export class FeedQuery {
  @IsOptional()
  @ApiProperty({ description: 'tab?', required: false, type: String })
  tab?: 'recommend' | 'latest' | 'hot';

  @IsOptional()
  @ApiProperty({ description: 'categoryId?', required: false, type: String })
  categoryId?: string;

  @IsOptional()
  @ApiProperty({ description: 'kind?', required: false, type: String })
  kind?: (typeof POST_KINDS)[number];

  @IsOptional()
  @ApiProperty({ description: 'page?', required: false, type: String })
  page?: number;

  @IsOptional()
  @ApiProperty({ description: 'pageSize?', required: false, type: String })
  pageSize?: number;
}

export class ResolvePostDto {
  @IsBoolean({ message: 'resolved 必须是布尔值' })
  @ApiProperty({ description: 'resolved', required: true, type: Boolean })
  resolved!: boolean;
}

export class ReportPostDto {
  @IsString()
  @ApiProperty({ description: 'reason', required: true, type: String })
  reason!: string;

  @IsOptional()
  @ApiProperty({ description: 'detail?', required: false, type: String })
  detail?: string;
}
