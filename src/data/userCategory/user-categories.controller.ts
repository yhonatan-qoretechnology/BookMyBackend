import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { GetToken } from 'src/auth/common/decorators/get-token.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  AddUserCategoriesDto,
  CategoryResponseDto,
  GetUserCategoriesDto,
} from './dto/add-user-categories.dto'; // Asegúrate de que las rutas a los DTOs sean correctas
import { UserCategoriesService } from './user-categories.service';

interface CustomRequest extends Request {
  user: {
    userId: number;
    email: string;
    // ... otros campos del payload de tu token
  };
}

@ApiTags('user-categories') // Etiqueta para agrupar endpoints relacionados en la UI de Swagger
@ApiBearerAuth('access-token') // Documenta que se requiere un token Bearer (configurado en main.ts)
@UseGuards(JwtAuthGuard) // Protege todos los métodos del controlador con el guardia JWT
@Controller('user-categories')
export class UserCategoriesController {
  constructor(private readonly userCategoriesService: UserCategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Asociar categorías a un usuario',
    description:
      'Reemplaza todas las categorías previamente seleccionadas por el usuario con las nuevas enviadas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categorías de usuario actualizadas exitosamente.',
    type: Object, // Para la respuesta { message: string, count: number }
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos o IDs de categorías no encontrados.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado. Se requiere un token JWT válido.',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async addCategoriesToUser(
    @Req() req: CustomRequest,
    @Body() dto: AddUserCategoriesDto,
    @GetToken() token: string, // 👈 Se inyecta el token aquí
  ) {
    // Puedes usar 'token' aquí si lo necesitas para alguna lógica
    console.log('Token JWT recibido en POST:', token);

    const userId = req.user.userId;
    return this.userCategoriesService.updateUserCategories(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener las categorías seleccionadas por el usuario',
    description:
      'Recupera las categorías asociadas al usuario autenticado, con la opción de especificar el idioma para las traducciones.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorías del usuario.',
    type: [CategoryResponseDto], // Indica que la respuesta es un array de CategoryResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado. Se requiere un token JWT válido.',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiHeader({
    name: 'Accept-Language',
    description:
      'Idioma preferido para las traducciones (ej. "es", "en"). Se usará si no se especifica `lang` en el query parameter.',
    required: false,
    example: 'es',
  })
  async getUserCategories(
    @Req() req: CustomRequest,
    @Query() query: GetUserCategoriesDto,
    @GetToken() token: string, // 👈 Se inyecta el token también aquí
  ): Promise<CategoryResponseDto[]> {
    // Puedes usar 'token' aquí si lo necesitas para alguna lógica
    console.log('Token JWT recibido en GET:', token);

    const userId = req.user.userId;
    const lang =
      query.lang ||
      req.headers['accept-language']?.split(',')[0].toLowerCase() ||
      'es';

    return this.userCategoriesService.getUserCategories(userId, lang);
  }
}
