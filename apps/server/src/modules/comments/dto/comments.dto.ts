import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @ApiProperty({ description: 'content', required: true, type: String })
  content!: string;

  @IsOptional()
  @ApiProperty({ description: 'parentId?', required: false, type: String })
  parentId?: string;

  @IsOptional()
  @ApiProperty({ description: 'replyToUserId?', required: false, type: String })
  replyToUserId?: string;
}
