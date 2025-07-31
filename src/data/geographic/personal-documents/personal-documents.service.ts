import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeographicService } from './../geographic.service';

@Injectable()
export class PersonalDocumentsService {
  constructor(
    private prismaService: PrismaService,
    private geographicService: GeographicService,
  ) {}

  async getDocumentTypesByCountry(countryId: string, clientType: ClientType) {
    // id o code
    const country = await this.geographicService.getCountry(countryId, true);

    const documentTypes =
      await this.prismaService.documentTypeByCountry.findMany({
        where: { countryId: country.id },
      });
    if (!documentTypes)
      throw new NotFoundException(
        `No existen documentos configurados para ${country.name}`,
      );

    const result = country.DocumentTypes.map(
      (documentType: any) => documentType.documentType,
    ).filter(({ type }) => type == clientType);

    if (result.length == 0)
      throw new NotFoundException(
        `No existen documentos configurados para ${country.name} tipo ${clientType}`,
      );

    return result;
  }
}
