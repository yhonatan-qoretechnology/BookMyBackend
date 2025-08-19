import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdatePassDto } from './dto/update-pass.dto';
import { ValidatePhoneDto } from './dto/validate-phone.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
}
