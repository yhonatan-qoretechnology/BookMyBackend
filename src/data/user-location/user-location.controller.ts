// src/data/user-location/user-location.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
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
import { Role } from '@prisma/client';
import { AuthUser } from '../../auth/common/decorators/auth-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { UserLocationService } from './user-location.service';
import { CreateUserLocationDto } from './dto/create-user-location.dto';

@ApiTags('User Location')
@Controller('users/:userId/location')
export class UserLocationController {
  constructor(private readonly service: UserLocationService) {}

  /* La ubicación es de cada uno: antes cualquier sesión leía o pisaba la
     latitud, longitud y dirección de cualquier usuario. */
  private exigirPropio(userId: number, user: AuthenticatedUser) {
    if (user.role !== Role.SUPER_ADMIN && user.userId !== userId) {
      throw new ForbiddenException('Solo puede ver o cambiar su ubicación.');
    }
  }

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
    @AuthUser() user: AuthenticatedUser,
  ) {
    this.exigirPropio(userId, user);
    return this.service.save(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener ubicación del usuario' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Ubicación encontrada' })
  async get(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    this.exigirPropio(userId, user);
    return this.service.get(userId);
  }
}
