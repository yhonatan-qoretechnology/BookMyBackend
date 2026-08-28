import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotInProductionGuard } from './guards/not-in-production.guard';
import { SeedService } from './seed.service';

// 🔒 Bloqueado fuera de desarrollo — ver NotInProductionGuard. Estos
// endpoints no tienen (ni deben tener) auth de usuario: son scripts de
// bootstrap que corren antes de que exista ningún admin. La protección
// real es que simplemente no existan fuera de dev.
@UseGuards(NotInProductionGuard)
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

  @Post('super-admin')
  @ApiOperation({
    summary:
      'Crear o actualizar el usuario SUPER_ADMIN inicial (solo desarrollo)',
  })
  async seedSuperAdmin() {
    return this.seedService.seedSuperAdmin();
  }

  @Post('company-admin')
  @ApiOperation({
    summary:
      'Crear o actualizar un COMPANY_ADMIN de prueba (requiere empresa creada)',
  })
  async seedCompanyAdmin() {
    return this.seedService.seedCompanyAdmin();
  }

  @Post('branch-admin')
  @ApiOperation({
    summary:
      'Crear o actualizar un BRANCH_ADMIN de prueba (requiere sede creada)',
  })
  async seedBranchAdmin() {
    return this.seedService.seedBranchAdmin();
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
