import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

export enum LanguageCode {
  ES = 'es',
  EN = 'en',
}
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

  async seedCategories() {
    console.log('🌱 Iniciando seed de categorías...');

    const categories = [
      {
        image: 'https://cdn.miapp.com/categories/belleza.png',
        translations: [
          {
            language: 'es',
            name: 'Belleza',
            description: 'Servicios de belleza y cuidado personal',
          },
          {
            language: 'en',
            name: 'Beauty',
            description: 'Beauty and personal care services',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/fitness.png',
        translations: [
          {
            language: 'es',
            name: 'Fitness',
            description: 'Entrenamiento y bienestar físico',
          },
          {
            language: 'en',
            name: 'Fitness',
            description: 'Training and physical wellness',
          },
        ],
      },
    ];

    // Limpiar tablas
    await this.prisma.categoryTranslation.deleteMany();
    await this.prisma.category.deleteMany();

    // Insertar datos
    for (const cat of categories) {
      await this.prisma.category.create({
        data: {
          image: cat.image,
          translations: {
            create: cat.translations.map((t) => ({
              language: t.language,
              name: t.name,
              description: t.description,
            })),
          },
        } satisfies Prisma.CategoryCreateInput,
      });
    }

    console.log('✅ Seed de categorías completado');
    return {
      message: 'Seed ejecutado correctamente',
      count: categories.length,
    };
  }

  async seedSedes() {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Solo disponible en entorno de desarrollo');
    }

    // ✅ Crear sedes con los campos correctos según tu modelo Prisma y DTO
    await this.prisma.sede.createMany({
      data: [
        {
          nombre: 'Sede Principal Medellín',
          direccion: 'Calle 10 # 5-20, Medellín',
          telefono: '+573001112233',
          latitud: 6.2476,
          longitud: -75.5658,
          provincia: 'Antioquia',
          horario: {
            lunes: '08:00-18:00',
            martes: '08:00-18:00',
            miércoles: '08:00-18:00',
            jueves: '08:00-18:00',
            viernes: '08:00-17:00',
            sábado: '09:00-13:00',
            domingo: 'Cerrado',
          },
          diasCerrado: ['2025-12-25', '2026-01-01'],
          empresaId: 1, // 👈 asegúrate de tener esta empresa creada
          imagenes: [
            '/uploads/sedes/1/front.jpg',
            '/uploads/sedes/1/interior.jpg',
          ],
        },
        {
          nombre: 'Sede Bogotá Norte',
          direccion: 'Carrera 15 # 80-22, Bogotá',
          telefono: '+573201556677',
          latitud: 4.711,
          longitud: -74.0721,
          provincia: 'Cundinamarca',
          horario: {
            lunes: '09:00-19:00',
            martes: '09:00-19:00',
            miércoles: '09:00-19:00',
            jueves: '09:00-19:00',
            viernes: '09:00-17:00',
            sábado: '10:00-14:00',
            domingo: 'Cerrado',
          },
          diasCerrado: ['2025-12-25', '2026-01-01'],
          empresaId: 1,
          imagenes: [
            '/uploads/sedes/2/front.jpg',
            '/uploads/sedes/2/interior.jpg',
          ],
        },
      ],
      skipDuplicates: true,
    });

    return { message: '✅ Seed de sedes ejecutado correctamente.' };
  }
}
