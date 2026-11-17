import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'leo@gesetecalderas.com' })
  @IsEmail({}, { message: 'Revisá el email' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Falta la contraseña' })
  @MaxLength(200)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña nueva tiene que tener al menos 8 caracteres' })
  @MaxLength(200)
  newPassword: string;
}
