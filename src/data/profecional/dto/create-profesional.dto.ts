import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateProfesionalDto {
  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre completo del profesional',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'Especialista en cortes modernos y tratamientos capilares.',
    description: 'Biografía o descripción del profesional',
    required: false,
  })
  @IsOptional()
  @IsString()
  biografia?: string;

  @ApiProperty({
    example: '+34666555444',
    description: 'Número de teléfono del profesional',
  })
  @IsNotEmpty()
  @IsString()
  phone: string;

  /* Correo REAL del empleado, al que se le manda el enlace para fijar su
     contrasena. El de login lo genera el backend (nombre@empresa.com) y es
     sintetico: no es un buzon al que se pueda escribir. Opcional, porque hay
     empleados que no dan correo; sin el, el admin le dicta las credenciales
     como hasta ahora. */
  @ApiProperty({
    example: 'ana.perez@gmail.com',
    description: 'Correo personal del empleado, para enviarle el enlace de acceso.',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  emailPersonal?: string;

  @ApiProperty({
    type: 'number',
    example: 1,
    description: 'ID de la sede a la que pertenece el profesional',
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  sedeId: number;

  @ApiProperty({
    example: 'Abc123@',
    description:
      'Contraseña de acceso del profesional. El email de acceso se genera automáticamente (nombre+@+empresa.com) y se le debe comunicar al profesional junto con esta contraseña.',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
