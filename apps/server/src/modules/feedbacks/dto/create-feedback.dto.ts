import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @IsString()
  @ApiProperty({ description: 'content', required: true, type: String })
  content: string;

  @IsOptional()
  @ApiProperty({ description: 'contact?', required: false, type: String })
  contact?: string;
}
