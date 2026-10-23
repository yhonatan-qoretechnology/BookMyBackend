import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnableBiometricDto {
  @ApiProperty({
    description:
      'Contraseña actual. Se pide aunque haya sesión: con solo un JWT robado no se puede dejar un acceso de 90 días.',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'iPhone de Ana' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: string;
}

export class BiometricTokenDto {
  @ApiProperty({ description: 'Token de dispositivo que devolvió /auth/biometric/enable o el último /auth/biometric/login.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  deviceToken: string;
}
