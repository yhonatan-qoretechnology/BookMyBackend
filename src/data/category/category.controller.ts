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
import { Public } from '../../auth/common/decorators/public.decorator';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { multerConfig } from 'src/config/multer.config';
import { CreateCategoryWithFileDto } from '../serviceCategory/dto/create-category-with-file.dto';
import { CategoryService } from './category.service';
import {
  BulkCreateCategoriesDto,
  CreateCategoryDto,
} from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear categoría (application/json)',
  })
  @ApiConsumes('application/json')
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      ejemplo: {
        summary: 'Categoría con ES y EN, sin imagen',
        value: {
          image: null,
          translations: [
            {
              language: 'es',
              name: 'Tecnología',
              description: 'Servicios de tecnología y soluciones digitales',
            },
            {
              language: 'en',
              name: 'Technology',
              description: 'Technology services and digital solutions',
            },
          ],
        },
      },
    },
  })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto, undefined);
  }

  @Post('multipart')
  @ApiOperation({
    summary: 'Crear categoría con traducciones e imagen (multipart/form-data)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCategoryWithFileDto })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async createMultipart(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.create(createCategoryDto, file);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Crear múltiples categorías (application/json)',
  })
  @ApiConsumes('application/json')
  @ApiBody({ type: BulkCreateCategoriesDto })
  async createBulk(@Body() bulkDto: BulkCreateCategoriesDto) {
    return this.categoryService.createBulk(bulkDto);
  }

  /* Catálogo público: la app móvil pinta las categorías en el alta de
     cuenta (app/services.tsx), antes de que exista sesión. Solo lectura;
     crear, editar y borrar siguen exigiendo token. */
  @Public()
  @Get()
  findAll(@Query('language') language: string = 'es') {
    return this.categoryService.findAll(language);
  }

  @Public()
  @Get('random')
  findThenRandom(@Query('language') language: string = 'es') {
    return this.categoryService.findThenRandom(language);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('language') language: string = 'es',
  ) {
    return this.categoryService.findOne(id, language);
  }

  @Put(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', multerConfig)) // 👈 aquí también
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.update(id, updateCategoryDto, file);
  }

  @Patch(':id/image')
  @ApiOperation({ summary: 'Actualizar solo la imagen de una categoría' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Imagen actualizada correctamente.',
  })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async updateImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.categoryService.updateImage(id, file);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
