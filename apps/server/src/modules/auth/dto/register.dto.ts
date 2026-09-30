import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @ApiProperty({ description: 'email', required: true, type: String })
  email!: string;

  @IsString()
  @ApiProperty({ description: 'password', required: true, type: String })
  password!: string;

  @IsString()
  @ApiProperty({ description: 'nickname', required: true, type: String })
  nickname!: string;
}
