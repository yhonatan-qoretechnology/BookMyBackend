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

  @Post('categories')
  @ApiOperation({ summary: 'Ejecuta el seed de categorías y traducciones' })
  async seedCategories() {
    return this.seedService.seedCategories();
  }

  @Post('seedSedes')
  @ApiOperation({ summary: 'Ejecutar seed de sedes (solo desarrollo)' })
  async seedSedes() {
    return this.seedService.seedSedes();
  }

  @Post('profesionales')
  async seedProfesionales() {
    return this.seedService.seedProfesionales();
  }

  @Post('services')
  @ApiOperation({ summary: 'Ejecutar seed de servicios' })
  async seedServices() {
    return this.seedService.seedServices();
  }

  @Post('service-sede-profesional')
  @ApiOperation({
    summary: 'Ejecutar seed de relaciones Service-Sede-Profesional',
  })
  async seedServiceSedeProfesional() {
    return this.seedService.seedServiceSedeProfesional();
  }
}
