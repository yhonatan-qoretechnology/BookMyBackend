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

  async seedProfesionales() {
    // ✅ Verificar que las sedes existan antes de insertar profesionales
    const sedes = await this.prisma.sede.findMany();
    if (sedes.length === 0) {
      throw new ForbiddenException(
        'No hay sedes registradas. Debes ejecutar primero el seed de sedes.',
      );
    }

    await this.prisma.profesional.createMany({
      data: [
        {
          nombre: 'Nayomi Clenshaw',
          biografia:
            'Manicurista profesional con amplia experiencia en tratamientos y diseño de uñas.',
          phone: '+34666555444',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/26140/resource_photos/29b0ef56cfba49b5b5a6b9e344c577-glow-benalmadena-nayomi-clenshaw-872338da480847949c01025f01db7a-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Lidia Sánchez',
          biografia:
            'Manicurista con atención al detalle y pasión por el arte en las uñas.',
          phone: '+34666555445',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/26140/resource_photos/29b0ef56cfba49b5b5a6b9e344c577-glow-benalmadena-nayomi-clenshaw-872338da480847949c01025f01db7a-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Priscila Cuervo',
          biografia:
            'Especialista en manicura moderna y técnicas de esmaltado profesional.',
          phone: '+34666555446',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/26140/resource_photos/5c819b901a174187b5a02f5b90617e-glow-benalmadena-priscila-cuervo-bbaefaa0c2694ff3ab2fca32d7181f-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Francesca Dela Magna',
          biografia:
            'Manicurista especializada en tratamientos estéticos y diseño artístico.',
          phone: '+34666555447',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/26140/resource_photos/2512c13228f848acbc2652a15a8847-glow-benalmadena-francesca-dela-magna-f291664ec0fb42a09a2b168c453680-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Laura',
          biografia:
            'Manicurista con amplia experiencia en técnicas modernas y tratamientos personalizados.',
          phone: '+34666555448',
          sedeId: 2,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/1b810cabfdba4ffba9202890e6712a-glow-fuengirola-laura-e36c370bb176421893583738986b8c-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Natalia',
          biografia:
            'Especialista en manicura y pedicura, dedicada al cuidado integral de las uñas.',
          phone: '+34666555449',
          sedeId: 2,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/629f3f297b154693a8ff2992ec350e-glow-fuengirola-natalia-c444ed18a3f341bca6afbbdee6f77c-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Gabriela',
          biografia:
            'Manicurista profesional con enfoque en tratamientos naturales y personalizados.',
          phone: '+34666555450',
          sedeId: 2,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/97eaa5d70ade4ccb94dbabde8cc2df-glow-fuengirola-gabriela-5c23aac4295b429ea292f86acc23d6-booksy.jpeg?size=250x250&size=100x100',
        },
      ],
      skipDuplicates: true,
    });

    return { message: '✅ Seed de profesionales ejecutado correctamente.' };
  }
}
