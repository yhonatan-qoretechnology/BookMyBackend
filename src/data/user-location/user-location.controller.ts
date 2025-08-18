// src/data/user-location/user-location.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateUserLocationDto,
  UserLocationService,
} from './user-location.service';

@ApiTags('User Location')
@Controller('users/:userId/location')
export class UserLocationController {
  constructor(private readonly service: UserLocationService) {}

  @Post()
  @ApiOperation({ summary: 'Crear/Actualizar ubicación del usuario (upsert)' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', example: 40.416775 },
        longitude: { type: 'number', example: -3.70379 },
        address: { type: 'string', example: 'Puerta del Sol,  Madrid, España' },
      },
      required: ['latitude', 'longitude'],
    },
  })
  @ApiResponse({ status: 201, description: 'Ubicación creada/actualizada' })
  async save(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateUserLocationDto,
  ) {
    return this.service.save(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener ubicación del usuario' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Ubicación encontrada' })
  async get(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.get(userId);
  }
}
