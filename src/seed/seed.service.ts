import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  async createSeed() {
    const filePath = path.resolve(__dirname, '../../prisma/seed-data.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    for (const country of data.countries) {
      const createdCountry = await this.prisma.country.create({
        data: {
          name: country.name,
          isoCode: country.isoCode,
          dialingCode: country.dialingCode,
        },
      });

      for (const doc of country.documentTypes) {
        const document = await this.prisma.documentType.upsert({
          where: { name: doc.name },
          update: {},
          create: {
            name: doc.name,
            acronym: doc.acronym,
            type: doc.type,
          },
        });

        await this.prisma.documentTypeByCountry.create({
          data: {
            countryId: createdCountry.id,
            documentTypeId: document.id,
          },
        });
      }
    }
  }

  ///seed de empresas
  async seedEmpresas() {
    const empresas = [
      {
        nombre: 'Glow',
        telefono: '+34664474706',
        email: 'servicio@glowexperience.eu',
        nit: '000000000-1',
        descripcion: 'Salud/belleza',
        logo: 'uploads/logos/f42bcfbb3666c38a6108c26b3da9ecd7',
      },
    ];

    await this.prisma.empresa.createMany({
      data: empresas,
      skipDuplicates: true,
    });

    return {
      message: 'Seed ejecutado correctamente.',
      total: empresas.length,
    };
  }
}
