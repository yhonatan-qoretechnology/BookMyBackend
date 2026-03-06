import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthUser } from './common/decorators/auth-user.decorator';
import { BootstrapSuperAdminDto } from './dto/bootstrap-super-admin.dto';
import { ChangePasswordByAdminDto } from './dto/change-password-by-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordOtpDto } from './dto/request-password-otp.dto';
import { UpdatePassDto } from './dto/update-pass.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidatePasswordOtpDto } from './dto/validate-password-otp.dto';
import { ValidatePhoneDto } from './dto/validate-phone.dto';
import { AuthenticatedUser } from './types/authenticated-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('users')
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  async findAllUsers(@AuthUser() user: AuthenticatedUser) {
    return this.authService.findAllUsers(user);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async findUserById(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.authService.findUserById(id, user);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario con foto opcional' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado correctamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegisterDto })
  @UseInterceptors(
    FileInterceptor('fotoPerfil', {
      dest: './uploads/users/temp',
    }),
  )
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    const result = await this.authService.register(dto, file, user);
    return {
      message: 'User registered successfully',
      user: result,
    };
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    if ((result as any)?.token) {
      res.cookie('access_token', (result as any).token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 12 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Post('bootstrap-super-admin')
  @ApiOperation({
    summary:
      'Crear un usuario SUPER_ADMIN solo en entornos no productivos (bootstrap)',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o SUPER_ADMIN ya existe.',
  })
  async bootstrapSuperAdmin(@Body() dto: BootstrapSuperAdminDto) {
    return this.authService.bootstrapSuperAdmin(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer la contraseña con un token' })
  @ApiHeader({
    name: 'x-reset-token',
    description:
      'Token recibido por correo electrónico para resetear contraseña',
    required: true,
  })
  @ApiBody({ type: UpdatePassDto })
  async resetPassword(@Req() req: Request, @Body() body: UpdatePassDto) {
    const token = req.headers['x-reset-token'] as string;

    if (!token) {
      throw new HttpException(
        'Token de reseteo no encontrado en el header',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      throw new HttpException(
        'La nueva contraseña es inválida o muy corta',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.authService.recoveryPass(token, newPassword);
  }
  /*
  //GET
/auth/user-existence-contact/{email}/{phone}
  @Get('user-existence-contact/{:email}/{:phone}')
  async checkUserExistence(
    @Param('email') email: string,
    @Param('phone') phone: string,
  ) {
    return this.authService.checkUserExistence(email, phone);
  }*/

  @Post('validate-phone')
  async validatePhone(@Body() dto: ValidatePhoneDto) {
    return this.authService.validatePhone(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Actualizar los datos de un usuario' })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado correctamente.',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUserProfile(id, dto);
  }

  @Patch('users/:id/foto')
  @ApiOperation({ summary: 'Actualizar la foto de perfil del usuario' })
  @ApiResponse({ status: 200, description: 'Foto actualizada correctamente.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiBadRequestResponse({ description: 'Debe adjuntar un archivo de imagen.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fotoPerfil: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['fotoPerfil'],
    },
  })
  @UseInterceptors(
    FileInterceptor('fotoPerfil', {
      dest: './uploads/users/temp',
    }),
  )
  async updateUserPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar una imagen.');
    }
    return this.authService.updateUserPhoto(id, file);
  }

  @Post('users/password/otp/request')
  @ApiOperation({
    summary: 'Solicitar un OTP por correo para iniciar cambio de contraseña',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async requestPasswordOtp(@Body() dto: RequestPasswordOtpDto) {
    return this.authService.requestPasswordOtp(dto);
  }

  @Post('users/password/otp/validate')
  @ApiOperation({
    summary: 'Validar un código OTP previo al cambio de contraseña',
  })
  @ApiBadRequestResponse({ description: 'Código OTP inválido o expirado.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async validatePasswordOtp(@Body() dto: ValidatePasswordOtpDto) {
    return this.authService.validatePasswordOtp(dto);
  }

  @Patch('users/:id/password')
  @ApiOperation({
    summary: 'Actualizar contraseña usando la contraseña actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada correctamente.',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiBadRequestResponse({ description: 'Entrada inválida.' })
  async changePasswordWithCurrent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePasswordWithCurrent(id, dto);
  }

  @Patch('users/:id/password/direct')
  @ApiOperation({
    summary: 'Actualizar contraseña únicamente con el ID del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada correctamente.',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiBadRequestResponse({ description: 'Entrada inválida.' })
  async changePasswordById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordByAdminDto,
  ) {
    return this.authService.changePasswordById(id, dto);
  }
}
