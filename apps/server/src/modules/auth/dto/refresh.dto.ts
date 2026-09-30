import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @IsString()
  @ApiProperty({ description: 'refreshToken', required: true, type: String })
  refreshToken!: string;
}
