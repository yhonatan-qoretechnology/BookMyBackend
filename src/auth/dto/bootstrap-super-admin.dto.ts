import { ApiProperty } from '@nestjs/swagger';
import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ClientState, ClientType } from './register.dto';

export class BootstrapSuperAdminDto {
  @ApiProperty({ example: 'Root Super Admin', description: 'Full name of the SUPER_ADMIN' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: '+348001112233',
    description: 'Phone number with country code',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'superadmin@example.com',
    description: 'Email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123$', description: 'Secure password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Masculino', description: 'Gender' })
  @IsNotEmpty()
  @IsString()
  gender: string;

  @ApiProperty({ example: 'es', description: 'Language' })
  @IsNotEmpty()
  @IsString()
  idioma: string;

  @ApiProperty({ example: 1, description: 'Country ID (foreign key)' })
  @IsNotEmpty()
  countryId: number;

  @ApiProperty({
    example: '1990-01-15',
    description: 'Date of birth (YYYY-MM-DD)',
    required: false,
  })
  @IsDateString()
  birthdate?: string;

  @ApiProperty({
    example: 'business',
    enum: ClientType,
    description: 'Client type (person or business)',
  })
  @IsEnum(ClientType)
  clientType: ClientType;

  @ApiProperty({
    example: 'enabled',
    enum: ClientState,
    description: 'User state (enabled, disabled, or blocked)',
  })
  @IsEnum(ClientState)
  state: ClientState;
}
