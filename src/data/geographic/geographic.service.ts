import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GeographicService {
  constructor(private prisma: PrismaService) {}

  public async getGeographicData() {
    const countries = await this.prisma.country.findMany();
    return countries;
  }

  async getCountry(
    countryId: string | number,
    includeDocTypes: boolean = false,
  ) {
    const id = Number(countryId);
    const isoCode = String(countryId);

    const country = await this.prisma.country.findFirst({
      where: {
        OR: [
          { id: isNaN(id) ? undefined : id },
          {
            isoCode: {
              equals: isoCode,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        DocumentTypes: includeDocTypes
          ? {
              include: {
                documentType: true,
              },
            }
          : false,
      },
    });

    if (!country) {
      throw new NotFoundException(`Country '${countryId}' not found`);
    }

    return country;
  }
}
