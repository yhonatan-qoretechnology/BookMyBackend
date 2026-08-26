import { ApiProperty } from '@nestjs/swagger';

/* ============================================================
   DTOs de RESPUESTA (solo para que Swagger muestre el schema real
   que devuelve el backend). El controller nunca instancia estas
   clases — Prisma devuelve objetos planos — se usan únicamente en
   @ApiResponse/@ApiOkResponse/@ApiCreatedResponse con `type:`.
   Antes de esto, ningún @ApiResponse tenía `type`, así que Swagger
   no mostraba NINGÚN campo de la respuesta (ni imagenes, ni id,
   ni nada) — solo la descripción en texto.
============================================================ */

export class ServicePriceResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() serviceId: number;
  @ApiProperty() amount: number;
  @ApiProperty() duration: number;
  @ApiProperty() currency: string;
}

export class ServiceTranslationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() serviceId: number;
  @ApiProperty() language: string;
  @ApiProperty() name: string;
  @ApiProperty({ required: false, nullable: true }) description?: string | null;
}

// Cubre tanto el select "liviano" de findBySede como el más completo
// de findByCategory — algunos campos no vienen según el endpoint.
export class ServiceSedeSummaryResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() nombre: string;
  @ApiProperty({ required: false, nullable: true }) direccion?: string;
  @ApiProperty({ required: false, nullable: true }) telefono?: string | null;
  @ApiProperty({ required: false, nullable: true }) latitud?: number | null;
  @ApiProperty({ required: false, nullable: true }) longitud?: number | null;
  @ApiProperty({ required: false, nullable: true }) provincia?: string | null;
  @ApiProperty({ required: false }) horario?: unknown;
  @ApiProperty({ required: false }) diasCerrado?: unknown;
  @ApiProperty({ type: [String], required: false })
  imagenes?: string[];
  @ApiProperty({ required: false }) createdAt?: Date;
  @ApiProperty({ required: false }) updatedAt?: Date;
}

export class ServiceProfesionalSummaryResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() nombre: string;
  @ApiProperty({ required: false, nullable: true }) biografia?: string | null;
  @ApiProperty({ required: false, nullable: true }) imagen?: string | null;
  @ApiProperty({ required: false, nullable: true }) phone?: string | null;
  @ApiProperty({ required: false }) state?: string;
  @ApiProperty({ required: false }) createdAt?: Date;
  @ApiProperty({ required: false }) updatedAt?: Date;
}

export class ServiceCategorySummaryResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ required: false, nullable: true }) image?: string | null;
}

/** POST /services · PUT /services/:id · GET /services/:id */
export class ServiceDetailResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() categoryId: number;
  @ApiProperty({ type: [ServiceTranslationResponseDto] })
  translations: ServiceTranslationResponseDto[];
  @ApiProperty({ type: [ServicePriceResponseDto] })
  prices: ServicePriceResponseDto[];
  @ApiProperty({ type: [ServiceSedeSummaryResponseDto] })
  sedes: ServiceSedeSummaryResponseDto[];
  @ApiProperty({
    type: [String],
    description: 'Rutas relativas de las imágenes del servicio',
    example: ['uploads/bookmy/services/12/abc123.jpg'],
  })
  imagenes: string[];
  @ApiProperty({ required: false }) createdAt?: Date;
  @ApiProperty({ required: false }) updatedAt?: Date;
}

/** GET /services */
export class ServiceListItemResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: [ServicePriceResponseDto] })
  prices: ServicePriceResponseDto[];
  @ApiProperty({ type: [ServiceSedeSummaryResponseDto] })
  sedes: ServiceSedeSummaryResponseDto[];
  @ApiProperty({
    type: [String],
    description: 'Rutas relativas de las imágenes del servicio',
    example: ['uploads/bookmy/services/12/abc123.jpg'],
  })
  imagenes: string[];
  @ApiProperty() categoryId: number;
  @ApiProperty({ type: ServiceCategorySummaryResponseDto, nullable: true })
  category: ServiceCategorySummaryResponseDto | null;
}

/** GET /services/category/:categoryId */
export class ServiceByCategoryItemResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({ type: [ServicePriceResponseDto] })
  prices: ServicePriceResponseDto[];
  @ApiProperty({
    type: [String],
    description: 'Rutas relativas de las imágenes del servicio',
  })
  imagenes: string[];
  @ApiProperty({ type: [ServiceSedeSummaryResponseDto] })
  sedes: ServiceSedeSummaryResponseDto[];
  @ApiProperty({ type: [ServiceProfesionalSummaryResponseDto] })
  profesionales: ServiceProfesionalSummaryResponseDto[];
}

/** GET /services/by-sede/:sedeId */
export class ServiceBySedeItemResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() category: string;
  @ApiProperty({ type: [ServicePriceResponseDto] })
  prices: ServicePriceResponseDto[];
  @ApiProperty({
    type: [String],
    description: 'Rutas relativas de las imágenes del servicio',
  })
  imagenes: string[];
  @ApiProperty({ type: [ServiceProfesionalSummaryResponseDto] })
  profesionales: ServiceProfesionalSummaryResponseDto[];
  @ApiProperty({ type: ServiceSedeSummaryResponseDto, required: false })
  sede?: ServiceSedeSummaryResponseDto;
}

/** Devuelto por remove() y por los endpoints de imagen (addImage,
    addImagenes, removeImagenes, replaceImageByIndex): un update/delete
    de Prisma sin `include`, solo columnas propias del servicio. */
export class ServiceBareResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() categoryId: number;
  @ApiProperty({
    type: [String],
    description: 'Rutas relativas de las imágenes del servicio',
  })
  imagenes: string[];
  @ApiProperty({ required: false }) createdAt?: Date;
  @ApiProperty({ required: false }) updatedAt?: Date;
}
