import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 个人资料更新（PATCH /auth/me） */
export class UpdateProfileDto {
  @IsOptional()
  @ApiProperty({ description: 'nickname?', required: false, type: String })
  nickname?: string;

  @IsOptional()
  @ApiProperty({ description: 'avatar?', required: false, type: String })
  avatar?: string;

  @IsOptional()
  @ApiProperty({ description: 'bio?', required: false, type: String })
  bio?: string;

  @IsOptional()
  @ApiProperty({ description: 'college?', required: false, type: String })
  college?: string;

  @IsOptional()
  @ApiProperty({ description: 'major?', required: false, type: String })
  major?: string;

  @IsOptional()
  @ApiProperty({ description: 'grade?', required: false, type: String })
  grade?: string;

  @IsOptional()
  @ApiProperty({ description: 'gender?', required: false, type: String })
  gender?: number;

  @IsOptional()
  @ApiProperty({ description: 'tags?', required: false, type: String })
  tags?: string[];
}
