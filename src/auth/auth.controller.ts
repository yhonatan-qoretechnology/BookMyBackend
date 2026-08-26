import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthUser } from './common/decorators/auth-user.decorator';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { BootstrapSuperAdminDto } from './dto/bootstrap-super-admin.dto';
import { ChangePasswordByAdminDto } from './dto/change-password-by-admin.dto';
import { ChangePasswordOtpDto } from './dto/change-password-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordOtpDto } from './dto/request-password-otp.dto';
import { UpdatePassDto } from './dto/update-pass.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidatePasswordOtpDto } from './dto/validate-password-otp.dto';
import { ValidatePhoneDto } from './dto/validate-phone.dto';
import { AuthenticatedUser } from './types/authenticated-user.interface';

/** Roles que pueden operar sobre cuentas ajenas. */
const ADMIN_ROLES = [
  Role.SUPER_ADMIN,
  Role.COMPANY_ADMIN,
  Role.BRANCH_ADMIN,
] as const;

@ApiTags('Auth')
@ApiBearerAuth()
/*
 * Los guards van a nivel de clase y lo público se marca con `@Public()`, de modo
 * que una ruta nueva nace protegida: hay que acordarse de abrirla, no de
 * cerrarla. Antes el controlador no declaraba guards y, al no haber guard
 * global, todas sus rutas quedaban accesibles sin sesión.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** Solo el propio usuario o un administrador pueden tocar una cuenta. */
  private assertCanActOnUser(
    actor: AuthenticatedUser | undefined,
    targetUserId: number,
  ) {
    if (!actor) {
      throw new ForbiddenException(
        'No se pudo recuperar el usuario autenticado.',
      );
    }

    const isAdmin = (ADMIN_ROLES as readonly Role[]).includes(actor.role);

    if (!isAdmin && actor.userId !== targetUserId) {
      throw new ForbiddenException(
        'No puedes acceder a los datos de otro usuario.',
      );
    }
  }

  @Get('users')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  @ApiForbiddenResponse({ description: 'Requiere rol administrador.' })
  async findAllUsers(@AuthUser() user: AuthenticatedUser) {
    return this.authService.findAllUsers(user);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  @ApiForbiddenResponse({
    description: 'Solo el propio usuario o un administrador.',
  })
  async findUserById(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    this.assertCanActOnUser(user, id);
    return this.authService.findUserById(id, user);
  }

  @Public()
  @Post(['register', 'users'])
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

  @Public()
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

  @Public()
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

  // Pública a propósito: se autentica con el token de un solo uso que llega por
  // correo en la cabecera `x-reset-token`, no con la sesión.
  @Public()
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

    // La longitud y la complejidad las valida ya `UpdatePassDto` con la
    // política común, así que aquí no se vuelve a comprobar a mano (aquel
    // `length < 6` contradecía al resto de la aplicación).
    const { newPassword } = body;

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

  @Public()
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
  @ApiForbiddenResponse({
    description: 'Solo el propio usuario o un administrador.',
  })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @AuthUser() actor: AuthenticatedUser,
  ) {
    this.assertCanActOnUser(actor, id);
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
  @ApiForbiddenResponse({
    description: 'Solo el propio usuario o un administrador.',
  })
  async updateUserPhoto(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() actor: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertCanActOnUser(actor, id);

    if (!file) {
      throw new BadRequestException('Debe adjuntar una imagen.');
    }
    return this.authService.updateUserPhoto(id, file);
  }

  // Las tres rutas de OTP son públicas por necesidad: quien ha olvidado la
  // contraseña no tiene sesión. La autenticación es el código enviado al correo.
  @Public()
  @Post('users/password/otp/request')
  @ApiOperation({
    summary: 'Solicitar un OTP por correo para iniciar cambio de contraseña',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async requestPasswordOtp(@Body() dto: RequestPasswordOtpDto) {
    return this.authService.requestPasswordOtp(dto);
  }

  @Public()
  @Post('users/password/otp/validate')
  @ApiOperation({
    summary: 'Validar un código OTP previo al cambio de contraseña',
  })
  @ApiBadRequestResponse({ description: 'Código OTP inválido o expirado.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async validatePasswordOtp(@Body() dto: ValidatePasswordOtpDto) {
    return this.authService.validatePasswordOtp(dto);
  }

  @Public()
  @Patch('users/password/otp/change')
  @ApiOperation({
    summary: 'Cambiar contraseña usando OTP (recuperación de contraseña)',
  })
  @ApiBadRequestResponse({ description: 'Código OTP inválido o expirado.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async changePasswordWithOtp(@Body() dto: ChangePasswordOtpDto) {
    return this.authService.changePasswordWithOtp(dto);
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
  @ApiForbiddenResponse({
    description: 'Solo el propio usuario o un administrador.',
  })
  async changePasswordWithCurrent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
    @AuthUser() actor: AuthenticatedUser,
  ) {
    this.assertCanActOnUser(actor, id);
    return this.authService.changePasswordWithCurrent(id, dto);
  }

  // No pide la contraseña actual, así que queda restringida a administradores:
  // es la vía que usa el panel para fijar la contraseña de un cliente.
  @Patch('users/:id/password/direct')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Actualizar contraseña únicamente con el ID del usuario',
  })
  @ApiForbiddenResponse({ description: 'Requiere rol administrador.' })
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
