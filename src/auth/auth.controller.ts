import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
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
import { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { AccesoUsuarioService } from './services/acceso-usuario/acceso-usuario.service';
import { AuthUser } from './common/decorators/auth-user.decorator';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CompletePasswordSetupDto } from './dto/complete-password-setup.dto';
import { PasswordSetupService } from './services/password-setup/password-setup.service';
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

const ACCESS_TOKEN_COOKIE = 'access_token';

/*
 * Las opciones de la cookie de sesion, en un solo sitio: el login la emite con
 * ellas y el logout la borra con ellas TAL CUAL. El navegador solo borra una
 * cookie si el nombre, el path y el dominio coinciden con los de la que
 * guardo, asi que dos listas separadas acaban en un logout que no borra nada y
 * no avisa de ello.
 *
 * `secure` sale del entorno y no es `true` a secas: en desarrollo el panel
 * habla por http y una cookie Secure no llegaria a guardarse.
 */
const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

@ApiTags('Auth')
@ApiBearerAuth()
/*
 * Los guards van a nivel de clase y lo público se marca con `@Public()`, de modo
 * que una ruta nueva nace protegida: hay que acordarse de abrirla, no de
 * cerrarla. Antes el controlador no declaraba guards y, al no haber guard
 * global, todas sus rutas quedaban accesibles sin sesión.
 */
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly passwordSetupService: PasswordSetupService,
    private readonly accesoUsuarioService: AccesoUsuarioService,
  ) {}

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
  /* fuerza bruta de contraseñas */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if ((result as any)?.token) {
      res.cookie(ACCESS_TOKEN_COOKIE, (result as any).token, {
        ...ACCESS_TOKEN_COOKIE_OPTIONS,
        maxAge: 12 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  /* Publica a proposito: cerrar sesion tiene que funcionar tambien con el
     token caducado o ya invalido. Si exigiera sesion valida, el caso en el que
     mas falta hace seria justo el unico en el que no se podria usar. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesion',
    description:
      'Borra la cookie access_token con las mismas opciones con que se emite. El token que el panel guarde por su cuenta lo tira el panel.',
  })
  @ApiResponse({ status: 200, description: 'Cookie de sesion borrada.' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE_OPTIONS);
    return { ok: true };
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
  /* Publicas a proposito: quien las usa todavia NO tiene contrasena, asi que
     no puede tener sesion. Las protege el propio token de un solo uso. */
  @Public()
  @Get('password-setup/validate')
  @ApiOperation({
    summary: 'Comprobar el enlace de alta de un empleado',
    description: 'Dice si el enlace sigue sirviendo, sin gastarlo.',
  })
  async validatePasswordSetup(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Falta el token');
    return this.passwordSetupService.validate(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('password-setup/complete')
  @ApiOperation({
    summary: 'Fijar la contrasena con el enlace del correo',
    description: 'Gasta el token y deja la cuenta lista para iniciar sesion.',
  })
  async completePasswordSetup(@Body() dto: CompletePasswordSetupDto) {
    return this.passwordSetupService.complete(dto.token, dto.password);
  }

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
  /* enumeración de teléfonos registrados */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
  /* cada solicitud manda un correo/SMS */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('users/password/otp/request')
  @ApiOperation({
    summary: 'Solicitar un OTP por correo para iniciar cambio de contraseña',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  async requestPasswordOtp(@Body() dto: RequestPasswordOtpDto) {
    return this.authService.requestPasswordOtp(dto);
  }

  @Public()
  /* adivinar el código de 6 dígitos */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
  /* adivinar el código de 6 dígitos */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  // Panel de "Seguimiento y Control": auditoría de login (IP, país,
  // dispositivo). Solo SUPER_ADMIN la puede ver.
  @Get('accesos')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Listar los accesos (login) registrados' })
  @ApiForbiddenResponse({ description: 'Requiere rol SUPER_ADMIN.' })
  async listarAccesos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('email') email?: string,
    @Query('pais') pais?: string,
    @Query('soloFallidos') soloFallidos?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.accesoUsuarioService.listar({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      email,
      pais,
      soloFallidos: soloFallidos === 'true',
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  @Get('accesos/resumen')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Resumen de accesos: totales, fallidos y países distintos',
  })
  @ApiForbiddenResponse({ description: 'Requiere rol SUPER_ADMIN.' })
  async resumenAccesos(@Query('dias') dias?: string) {
    return this.accesoUsuarioService.resumen(dias ? parseInt(dias, 10) : undefined);
  }
}
