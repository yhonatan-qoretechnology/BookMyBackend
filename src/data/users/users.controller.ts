import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SaveUserCategoriesDto } from './dto/save-user-categories.dto';
import { UsersService } from './users.service';

interface JwtRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('me/categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Guardar categorías seleccionadas del usuario autenticado',
    description:
      'Reemplaza las categorías previamente seleccionadas por el usuario por las nuevas enviadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categorías guardadas correctamente.',
  })
  async saveMyCategories(
    @Req() req: JwtRequest,
    @Body() dto: SaveUserCategoriesDto,
  ) {
    const userId = req.user.userId;
    return this.usersService.saveSelectedCategories(userId, dto.categoryIds);
  }
}
