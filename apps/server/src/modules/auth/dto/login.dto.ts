import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @ApiProperty({ description: 'email', required: true, type: String })
  email!: string;

  @IsString()
  @ApiProperty({ description: 'password', required: true, type: String })
  password!: string;
}
