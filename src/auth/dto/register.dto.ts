import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

enum State {
  disabled = 'disabled',
  enabled = 'enabled',
  blocked = 'blocked',
}

enum ClientType {
  people = 'people',
  business = 'business',
}

export class RegisterDto {
  @ApiProperty({ example: 'John', description: 'First name of the user' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: '+34612345678',
    description: 'Phone number with country code',
  })
  @IsNotEmpty()
  @IsPhoneNumber('CO')
  phone: string;

  @ApiProperty({
    example: 'email@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Abc123@', description: 'Secure password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Masculino', description: 'genero' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  genero: string;

  @ApiProperty({ example: 'Español', description: 'idioma' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  idioma: string;

  @ApiProperty({ example: 1, description: 'Country ID (foreign key)' })
  @IsNotEmpty()
  @IsNumber()
  countryId: number;

  @ApiProperty({ example: true, description: 'Accept terms and conditions' })
  @IsBoolean()
  acceptTerms: boolean;

  @ApiProperty({ example: true, description: 'Accept privacy policy' })
  @IsBoolean()
  acceptPolitics: boolean;

  @ApiProperty({
    example: 'people',
    enum: ClientType,
    description: 'Client type (person or business)',
  })
  @IsEnum(ClientType)
  clientType: ClientType;

  @ApiProperty({
    example: '1990-01-15',
    description: 'Date of birth of the user (YYYY-MM-DD)',
  })
  @IsNotEmpty()
  @IsDateString()
  birthdate: string;
}
