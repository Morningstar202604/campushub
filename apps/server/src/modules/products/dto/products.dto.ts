import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const CONDITIONS = ['new', 'almost_new', 'good', 'fair', 'damaged'] as const;
export const PRODUCT_STATUSES = ['on_sale', 'sold', 'off_shelf', 'deleted'] as const;

export class CreateProductDto {
  // 分类 id 为固定可读文本（cat_idle 等）
  @IsString()
  @ApiProperty({ description: 'categoryId', required: true, type: String })
  categoryId!: string;

  @IsString()
  @ApiProperty({ description: 'title', required: true, type: String })
  title!: string;

  @IsOptional()
  @ApiProperty({ description: 'description?', required: false, type: String })
  description?: string;

  @IsOptional()
  @ApiProperty({ description: 'images?', required: false, type: [String] })
  images?: string[];

  @Type(() => Number)
  @IsNumber({}, { message: '价格必须是数字' })
  @Min(0.01, { message: '价格必须大于 0' })
  @ApiProperty({ description: 'price', required: true, type: Number })
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '原价必须是数字' })
  @ApiProperty({ description: 'originalPrice?', required: false, type: Number, nullable: true })
  originalPrice?: number;

  @IsOptional()
  @IsIn(CONDITIONS, { message: '成色参数不合法' })
  @ApiProperty({ description: 'condition?', required: false, type: String })
  condition?: (typeof CONDITIONS)[number];

  @IsOptional()
  @ApiProperty({ description: 'tradeType?', required: false, type: String })
  tradeType?: string;

  @IsOptional()
  @ApiProperty({ description: 'location?', required: false, type: String })
  location?: string;

  @IsOptional()
  @ApiProperty({ description: 'contactInfo?', required: false, type: String })
  contactInfo?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @ApiProperty({ description: 'categoryId?', required: false, type: String })
  categoryId?: string;

  @IsOptional()
  @ApiProperty({ description: 'title?', required: false, type: String })
  title?: string;

  @IsOptional()
  @ApiProperty({ description: 'description?', required: false, type: String })
  description?: string;

  @IsOptional()
  @ApiProperty({ description: 'images?', required: false, type: [String] })
  images?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '价格必须是数字' })
  @ApiProperty({ description: 'price?', required: false, type: Number })
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '原价必须是数字' })
  @ApiProperty({ description: 'originalPrice?', required: false, type: Number, nullable: true })
  originalPrice?: number;

  @IsOptional()
  @ApiProperty({ description: 'condition?', required: false, type: String })
  condition?: (typeof CONDITIONS)[number];

  @IsOptional()
  @ApiProperty({ description: 'tradeType?', required: false, type: String })
  tradeType?: string;

  @IsOptional()
  @ApiProperty({ description: 'location?', required: false, type: String })
  location?: string;

  @IsOptional()
  @ApiProperty({ description: 'contactInfo?', required: false, type: String })
  contactInfo?: string;
}

export class UpdateProductStatusDto {
  @IsIn(['on_sale', 'off_shelf', 'sold'], { message: '状态不正确' })
  @ApiProperty({ description: 'status', required: true, type: String })
  status!: 'on_sale' | 'off_shelf' | 'sold';
}

export class ReportProductDto {
  @IsString()
  @ApiProperty({ description: 'reason', required: true, type: String })
  reason!: string;

  @IsOptional()
  @ApiProperty({ description: 'detail?', required: false, type: String })
  detail?: string;
}

export class ProductQuery {
  @IsOptional()
  @ApiProperty({ description: 'categoryId?', required: false, type: String })
  categoryId?: string;

  @IsOptional()
  @ApiProperty({ description: 'condition?', required: false, type: String })
  condition?: (typeof CONDITIONS)[number];

  @IsOptional()
  @ApiProperty({ description: 'keyword?', required: false, type: String })
  keyword?: string;

  @IsOptional()
  @ApiProperty({ description: 'sort?', required: false, type: String })
  sort?: 'latest' | 'priceAsc' | 'priceDesc' | 'hot';

  @IsOptional()
  @ApiProperty({ description: 'page?', required: false, type: Number })
  page?: number;

  @IsOptional()
  @ApiProperty({ description: 'pageSize?', required: false, type: Number })
  pageSize?: number;
}
