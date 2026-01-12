import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { DiaCerradoSedeService } from './dia-cerrado-sede.service';
import { CreateDiaCerradoSedeDto } from './dto/create-dia-cerrado-sede.dto';
import { DiaCerradoSedeDto } from './dto/dia-cerrado-sede.dto';
import { UpdateDiaCerradoSedeDto } from './dto/update-dia-cerrado-sede.dto';

@ApiTags('DiaCerradoSede')
@Controller('dia-cerrado-sede')
export class DiaCerradoSedeController {
  constructor(private readonly service: DiaCerradoSedeService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo día cerrado para una sede' })
  @ApiResponse({ status: 201, type: DiaCerradoSedeDto })
  create(
    @Body() dto: CreateDiaCerradoSedeDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar días cerrados (con filtros opcionales)' })
  @ApiResponse({ status: 200, description: 'Lista de días cerrados' })
  findAll(
    @Query('sedeId') sedeId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const params: any = {};
    if (sedeId) params.sedeId = Number(sedeId);
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    return this.service.findAll(params);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener día cerrado por ID' })
  @ApiResponse({ status: 200, type: DiaCerradoSedeDto })
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar día cerrado por ID' })
  @ApiResponse({ status: 200, type: DiaCerradoSedeDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDiaCerradoSedeDto,
    @AuthUser() user?: AuthenticatedUser,
  ) {
    return this.service.update(Number(id), dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar día cerrado por ID' })
  @ApiResponse({ status: 200, description: 'Día cerrado eliminado' })
  remove(@Param('id') id: string, @AuthUser() user?: AuthenticatedUser) {
    return this.service.remove(Number(id), user);
  }
}
