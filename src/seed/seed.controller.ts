import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private seedService: SeedService) {}

  @Get()
  public createSeed() {
    return this.seedService.createSeed();
  }

  // 🔽 Nuevo endpoint para ejecutar el seed
  @Post('seed-empresas')
  @ApiOperation({ summary: 'Ejecutar seed de empresas (solo desarrollo)' })
  @ApiResponse({ status: 201, description: 'Seed ejecutado exitosamente.' })
  async seedEmpresas() {
    return this.seedService.seedEmpresas();
  }
}
