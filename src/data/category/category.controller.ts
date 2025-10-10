import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCategoryWithFileDto } from '../serviceCategory/dto/create-category-with-file.dto';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryImageDto } from './dto/update-category-image.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Crear categoría con traducciones e imagen' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCategoryWithFileDto })
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o idioma duplicado.' })
  @UseInterceptors(FileInterceptor('image', { dest: './uploads/categories' }))
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.create(createCategoryDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías por idioma' })
  @ApiResponse({ status: 200, description: 'Lista de categorías.' })
  findAll(@Query('language') language: string = 'es') {
    return this.categoryService.findAll(language);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID e idioma' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada.' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('language') language: string = 'es',
  ) {
    return this.categoryService.findOne(id, language);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar categoría (imagen opcional)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCategoryWithFileDto })
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos o idioma duplicado.' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada.' })
  @UseInterceptors(FileInterceptor('image', { dest: './uploads/categories' }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.update(id, updateCategoryDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría e imagen' })
  @ApiResponse({
    status: 200,
    description: 'Categoría eliminada correctamente.',
  })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }

  // 🔹 Endpoint para actualizar solo la imagen
  @Patch(':id/image')
  @ApiOperation({ summary: 'Actualizar solo la imagen de una categoría' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCategoryImageDto })
  @ApiResponse({
    status: 200,
    description: 'Imagen actualizada correctamente.',
  })
  @UseInterceptors(FileInterceptor('image', { dest: './uploads/categories' }))
  async updateImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.categoryService.updateImage(id, file);
  }
}
