import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** 帖子/商品/评论 状态修改（soft 语义：normal/deleted/on_sale/off_shelf…） */
export class SetStatusDto {
  @IsString()
  @IsNotEmpty({ message: 'status 不能为空' })
  @ApiProperty({ description: 'status', required: true, type: String })
  status!: string;
}

export class SetPinDto {
  @IsBoolean()
  @ApiProperty({ description: 'isPinned', required: true, type: Boolean })
  isPinned!: boolean;
}

export class SetEssenceDto {
  @IsBoolean()
  @ApiProperty({ description: 'isEssence', required: true, type: Boolean })
  isEssence!: boolean;
}

/** 举报处理：handled / dismissed（M0 草案 approved/rejected 已随 schema 调整为这两态） */
export class HandleReportDto {
  @IsIn(['handled', 'dismissed'], { message: 'status 只能是 handled / dismissed' })
  @ApiProperty({ description: 'status', required: true, type: String })
  status!: 'handled' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ description: 'note?', required: false, type: String })
  note?: string;
}

export class BanDto {
  @IsBoolean()
  @ApiProperty({ description: 'isBanned', required: true, type: Boolean })
  isBanned!: boolean;
}

export class SetAdminDto {
  @IsBoolean()
  @ApiProperty({ description: 'isAdmin', required: true, type: Boolean })
  isAdmin!: boolean;
}

/** 分类（v1 的 enabled 语义 → 新 schema status: active/hidden） */
export class SaveCategoryDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'id?', required: false, type: String })
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'name 不能为空' })
  @ApiProperty({ description: 'name', required: true, type: String })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'icon?', required: false, type: String })
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ description: 'sort?', required: false, type: Number })
  sort?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'enabled?', required: false, type: Boolean })
  enabled?: boolean;
}

/** 公告（v1 的 is_active 语义 → 新 schema status: active/inactive） */
export class SaveAnnouncementDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'id?（编辑时传，缺省=新建）', required: false, type: String })
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'title 不能为空' })
  @ApiProperty({ description: 'title', required: true, type: String })
  title!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'content?', required: false, type: String })
  content?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'isActive?', required: false, type: Boolean })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'isPinned?', required: false, type: Boolean })
  isPinned?: boolean;
}

export class SaveGuideCatDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'id?（编辑时传，缺省=新建）', required: false, type: String })
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'name 不能为空' })
  @ApiProperty({ description: 'name', required: true, type: String })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'icon?', required: false, type: String })
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ description: 'sort?', required: false, type: Number })
  sort?: number;
}

export class SaveGuideDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'id?（编辑时传，缺省=新建）', required: false, type: String })
  id?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'categoryId?', required: false, type: String })
  categoryId?: string;

  @IsString()
  @IsNotEmpty({ message: 'title 不能为空' })
  @ApiProperty({ description: 'title', required: true, type: String })
  title!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'summary?', required: false, type: String })
  summary?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'content?', required: false, type: String })
  content?: string;

  @IsOptional()
  @IsArray()
  @ApiProperty({ description: 'tags?', required: false, type: [String] })
  tags?: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'coverImage?', required: false, type: String })
  coverImage?: string;

  @IsOptional()
  @IsIn(['published', 'draft'], { message: 'status 只能是 published / draft' })
  @ApiProperty({ description: 'status?', required: false, type: String })
  status?: 'published' | 'draft';

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiProperty({ description: 'sort?', required: false, type: Number })
  sort?: number;
}

export class FeedbackDoneDto {
  @IsBoolean()
  @ApiProperty({ description: 'done', required: true, type: Boolean })
  done!: boolean;
}

export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'userId?（空=全站下发）', required: false, type: String })
  userId?: string;

  @IsString()
  @IsNotEmpty({ message: 'type 不能为空' })
  @ApiProperty({ description: 'type', required: true, type: String })
  type!: string;

  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  @ApiProperty({ description: 'content', required: true, type: String })
  content!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'targetType?', required: false, type: String })
  targetType?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'targetId?', required: false, type: String })
  targetId?: string;
}

/** 管理端通用分页查询 */
export class AdminPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ description: 'page?', required: false, type: Number })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @ApiProperty({ description: 'pageSize?', required: false, type: Number })
  pageSize?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'keyword?', required: false, type: String })
  keyword?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'categoryId?', required: false, type: String })
  categoryId?: string;
}

