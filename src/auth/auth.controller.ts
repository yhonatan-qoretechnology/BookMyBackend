import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      console.error('Error al registrar:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      // Prisma error por duplicado
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new HttpException(
          'El correo ya está registrado',
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        'Error interno al registrar usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Patch('update-password')
  async updatePassword(
    @Body() { token, password }: { token: string; password: string },
  ) {
    return this.authService.recoveryPass(token, password);
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
}
