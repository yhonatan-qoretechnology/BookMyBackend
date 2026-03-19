import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

export enum LanguageCode {
  ES = 'es',
  EN = 'en',
}

type AdminSeedConfig = {
  email: string;
  password: string;
  role: Role;
  firstName: string;
  lastName?: string;
  phone: string;
  countryId: number;
  idioma?: string;
  gender?: string;
  empresaId?: number | null;
  sedeId?: number | null;
};

type AdminSeedResult = {
  userId: number;
};
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async seedSuperAdmin() {
    const email = 'superadmin@bookmy.com';
    const password = 'SuperAdmin123$';
    const countryId = await this.ensureDefaultCountryId();

    try {
      const { userId } = await this.upsertAdmin({
        email,
        password,
        role: Role.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+34999999999',
        countryId,
        idioma: 'es',
        gender: 'no especificado',
      });

      return {
        message: 'Usuario SUPER_ADMIN sembrado correctamente.',
        credentials: {
          email,
          password,
        },
        userId,
      };
    } catch (error) {
      this.logger.error('Error al sembrar el SUPER_ADMIN', error as Error);
      throw error;
    }
  }

  async seedCompanyAdmin() {
    const email = 'company.admin@bookmy.com';
    const password = 'CompanyAdmin123$';
    const countryId = await this.ensureDefaultCountryId();

    const empresa = await this.prisma.empresa.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!empresa) {
      throw new ForbiddenException(
        'No hay empresas registradas. Ejecuta primero el seed de empresas.',
      );
    }

    const { userId } = await this.upsertAdmin({
      email,
      password,
      role: Role.COMPANY_ADMIN,
      firstName: 'Company',
      lastName: 'Admin',
      phone: '+34999999991',
      countryId,
      idioma: 'es',
      gender: 'no especificado',
      empresaId: empresa.id,
    });

    return {
      message: 'Usuario COMPANY_ADMIN sembrado correctamente.',
      credentials: {
        email,
        password,
      },
      userId,
      empresaId: empresa.id,
    };
  }

  async seedBranchAdmin() {
    const email = 'branch.admin@bookmy.com';
    const password = 'BranchAdmin123$';
    const countryId = await this.ensureDefaultCountryId();

    const sede = await this.prisma.sede.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!sede) {
      throw new ForbiddenException(
        'No hay sedes registradas. Ejecuta primero el seed de sedes.',
      );
    }

    const { userId } = await this.upsertAdmin({
      email,
      password,
      role: Role.BRANCH_ADMIN,
      firstName: 'Branch',
      lastName: 'Admin',
      phone: '+34999999992',
      countryId,
      idioma: 'es',
      gender: 'no especificado',
      empresaId: sede.empresaId,
      sedeId: sede.id,
    });

    return {
      message: 'Usuario BRANCH_ADMIN sembrado correctamente.',
      credentials: {
        email,
        password,
      },
      userId,
      empresaId: sede.empresaId,
      sedeId: sede.id,
    };
  }

  private async ensureDefaultCountryId(): Promise<number> {
    let country = await this.prisma.country.findFirst({
      orderBy: { id: 'asc' },
    });

    if (country) {
      return country.id;
    }

    await this.createSeed();

    country = await this.prisma.country.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!country) {
      throw new ForbiddenException(
        'No se encontraron países. Ejecuta el seed de países antes de crear administradores.',
      );
    }

    return country.id;
  }

  private async upsertAdmin(config: AdminSeedConfig): Promise<AdminSeedResult> {
    const hashedPassword = await bcrypt.hash(config.password, 12);

    const user = await this.prisma.users.upsert({
      where: { email: config.email },
      update: {
        role: config.role,
        clientType: 'business',
        state: 'enabled',
        acceptTerms: true,
        acceptPolitics: true,
        UserAuth: {
          upsert: {
            update: { password: hashedPassword },
            create: {
              email: config.email,
              password: hashedPassword,
            },
          },
        },
        UserData: {
          upsert: {
            update: {
              name: config.firstName,
              phone: config.phone,
              email: config.email,
              countryId: config.countryId,
              idioma: config.idioma ?? 'es',
              gender: config.gender ?? 'no especificado',
            },
            create: {
              name: config.firstName,
              phone: config.phone,
              email: config.email,
              countryId: config.countryId,
              idioma: config.idioma ?? 'es',
              gender: config.gender ?? 'no especificado',
            },
          },
        },
        AdminProfile: {
          upsert: {
            update: {
              firstName: config.firstName,
              lastName: config.lastName ?? '',
              phone: config.phone,
              empresaId: config.empresaId ?? null,
              sedeId: config.sedeId ?? null,
            },
            create: {
              firstName: config.firstName,
              lastName: config.lastName ?? '',
              phone: config.phone,
              empresaId: config.empresaId ?? null,
              sedeId: config.sedeId ?? null,
            },
          },
        },
      },
      create: {
        email: config.email,
        clientType: 'business',
        state: 'enabled',
        acceptTerms: true,
        acceptPolitics: true,
        role: config.role,
        UserAuth: {
          create: {
            email: config.email,
            password: hashedPassword,
          },
        },
        UserData: {
          create: {
            name: config.firstName,
            phone: config.phone,
            email: config.email,
            countryId: config.countryId,
            idioma: config.idioma ?? 'es',
            gender: config.gender ?? 'no especificado',
          },
        },
        AdminProfile: {
          create: {
            firstName: config.firstName,
            lastName: config.lastName ?? '',
            phone: config.phone,
            empresaId: config.empresaId ?? null,
            sedeId: config.sedeId ?? null,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return { userId: user.id };
  }

  async createSeed() {
    const filePath = path.resolve(process.cwd(), 'prisma', 'seed-data.json');
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
        nombre: 'Glow ',
        telefono: '+34651026700',
        email: 'info@glowexperience.eu',
        nit: 'B04940219',
        descripcion:
          'Reserva tus servicios de belleza en las sedes Glow Experience.',
        descripcionLarga:
          'Glow Experience es una marca especializada en servicios de belleza y bienestar, con sedes en España. Ofrecemos manicura, pedicura, estética facial, depilación y tratamientos personalizados, con un enfoque en calidad, experiencia y atención profesional.',
        facebookUrl: 'https://www.facebook.com/glowexperience',
        instagramUrl: 'https://www.instagram.com/glowexperience.eu',
        tiktokUrl: 'https://www.tiktok.com/@glowexperience',
        webUrl: 'https://byglow.es',
        logo: '',
      },
    ];

    try {
      await this.prisma.empresa.createMany({
        data: empresas,
        skipDuplicates: true,
      });

      return {
        message: 'Seed ejecutado correctamente.',
        total: empresas.length,
      };
    } catch (err: any) {
      console.error('Error al sembrar empresas:', {
        code: err?.code,
        meta: err?.meta,
        message: err?.message,
      });
      throw err;
    }
  }

  async seedCategories() {
    console.log('🌱 Iniciando seed de categorías...');

    const categories = [
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Cejas',
            description: 'Diseño y cuidado de cejas',
          },
          {
            language: 'en',
            name: 'Eyebrows',
            description: 'Eyebrow design and care services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Depilación con cera',
            description: 'Eliminación de vello con cera',
          },
          {
            language: 'en',
            name: 'Waxing',
            description: 'Hair removal using wax',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Depilación con cera para hombres',
            description: 'Depilación con cera especializada para hombres',
          },
          {
            language: 'en',
            name: 'Men Waxing',
            description: 'Waxing services for men',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Depilación con hilo',
            description: 'Depilación con técnica de hilo',
          },
          {
            language: 'en',
            name: 'Threading',
            description: 'Hair removal using thread technique',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Depilación láser',
            description: 'Eliminación de vello con tecnología láser',
          },
          {
            language: 'en',
            name: 'Laser Hair Removal',
            description: 'Hair removal using laser technology',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Dermapen',
            description: 'Tratamiento facial con microneedling',
          },
          {
            language: 'en',
            name: 'Dermapen',
            description: 'Microneedling facial treatment',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Extensiones Acrílicas',
            description: 'Extensión de uñas con acrílico',
          },
          {
            language: 'en',
            name: 'Acrylic Extensions',
            description: 'Acrylic nail extension services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Extensiones Polygel',
            description: 'Extensión de uñas con polygel',
          },
          {
            language: 'en',
            name: 'Polygel Extensions',
            description: 'Polygel nail extension services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Extras para tus uñas',
            description: 'Decoraciones y servicios adicionales para uñas',
          },
          {
            language: 'en',
            name: 'Nail Extras',
            description: 'Additional nail art and extra services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Head Spa',
            description:
              'Tratamientos capilares y relajación del cuero cabelludo',
          },
          {
            language: 'en',
            name: 'Head Spa',
            description: 'Scalp care and relaxation treatments',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Manicura',
            description: 'Servicios de manicura y cuidado de uñas',
          },
          {
            language: 'en',
            name: 'Manicure',
            description: 'Manicure and nail care services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Masajes corporales',
            description: 'Masajes terapéuticos y de relajación corporal',
          },
          {
            language: 'en',
            name: 'Body Massages',
            description: 'Therapeutic and relaxing body massages',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Pedicura',
            description: 'Servicios de pedicura y cuidado de pies',
          },
          {
            language: 'en',
            name: 'Pedicure',
            description: 'Pedicure and foot care services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Peluquería',
            description: 'Servicios de corte, peinado y cuidado del cabello',
          },
          {
            language: 'en',
            name: 'Hair Salon',
            description: 'Hair cutting, styling, and care services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Pestañas',
            description: 'Extensión y cuidado de pestañas',
          },
          {
            language: 'en',
            name: 'Eyelashes',
            description: 'Eyelash extensions and care',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Refuerzos',
            description: 'Refuerzo de uñas naturales',
          },
          {
            language: 'en',
            name: 'Nail Reinforcement',
            description: 'Natural nail strengthening services',
          },
        ],
      },
      {
        image: null,
        translations: [
          {
            language: 'es',
            name: 'Tratamientos faciales',
            description: 'Cuidado y tratamientos para la piel del rostro',
          },
          {
            language: 'en',
            name: 'Facial Treatments',
            description: 'Facial skin care treatments',
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

  async seedServices() {
    const services = [
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Manicura Semipermanente SPA',
            description:
              'Manicura con esmaltado semipermanente y tratamiento SPA',
          },
          {
            language: 'en',
            name: 'SPA Semi-Permanent Manicure',
            description: 'Semi-permanent manicure with SPA treatment',
          },
        ],
        prices: [{ amount: 25, duration: 60, currency: 'EUR' }],
        sedeIds: [1, 2, 3],
      },
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Manicura Rusa Semipermanente SPA',
            description:
              'Manicura rusa con esmaltado semipermanente y acabado preciso',
          },
          {
            language: 'en',
            name: 'Russian SPA Semi-Permanent Manicure',
            description:
              'Russian manicure with semi-permanent polish and precise finish',
          },
        ],
        prices: [{ amount: 30, duration: 75, currency: 'EUR' }],
        sedeIds: [1, 2, 3],
      },
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Manicura Esmaltado Tradicional SPA',
            description: 'Manicura con esmalte tradicional y tratamiento SPA',
          },
          {
            language: 'en',
            name: 'SPA Traditional Manicure',
            description: 'Traditional manicure with SPA treatment',
          },
        ],
        prices: [{ amount: 18, duration: 45, currency: 'EUR' }],
        sedeIds: [1, 2, 3],
      },
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Manicura Esmaltado Tradicional Hombre',
            description: 'Manicura tradicional enfocada en cuidado masculino',
          },
          {
            language: 'en',
            name: 'Men Traditional Manicure',
            description: 'Traditional manicure focused on men grooming',
          },
        ],
        prices: [{ amount: 20, duration: 40, currency: 'EUR' }],
        sedeIds: [1, 2, 3],
      },
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Manicura Semipermanente SPA con francesa',
            description:
              'Manicura semipermanente con diseño francés y acabado SPA',
          },
          {
            language: 'en',
            name: 'French SPA Semi-Permanent Manicure',
            description:
              'Semi-permanent manicure with French design and SPA finish',
          },
        ],
        prices: [{ amount: 28, duration: 65, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 11,
        translations: [
          {
            language: 'es',
            name: 'Decoración Francesa',
            description: 'Diseño francés adicional para manicura',
          },
          {
            language: 'en',
            name: 'French Nail Design',
            description: 'Additional French nail design service',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 2],
      },

      {
        categoryId: 13,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Semipermanente SPA',
            description:
              'Pedicura con esmaltado semipermanente y tratamiento SPA',
          },
          {
            language: 'en',
            name: 'SPA Semi-Permanent Pedicure',
            description: 'Semi-permanent pedicure with SPA treatment',
          },
        ],
        prices: [{ amount: 30, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 13,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Esmaltado tradicional SPA',
            description: 'Pedicura con esmalte tradicional y tratamiento SPA',
          },
          {
            language: 'en',
            name: 'SPA Traditional Pedicure',
            description: 'Traditional pedicure with SPA treatment',
          },
        ],
        prices: [{ amount: 25, duration: 50, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 13,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Semipermanente Jelly',
            description: 'Pedicura con efecto jelly y esmaltado semipermanente',
          },
          {
            language: 'en',
            name: 'Jelly Semi-Permanent Pedicure',
            description: 'Semi-permanent pedicure with jelly effect treatment',
          },
        ],
        prices: [{ amount: 35, duration: 70, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 13,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Esmaltado Tradicional Hombre',
            description: 'Pedicura tradicional enfocada en cuidado masculino',
          },
          {
            language: 'en',
            name: 'Men Traditional Pedicure',
            description: 'Traditional pedicure focused on men grooming',
          },
        ],
        prices: [{ amount: 28, duration: 45, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 13,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Esmaltado tradicional',
            description: 'Pedicura básica con esmalte tradicional',
          },
          {
            language: 'en',
            name: 'Basic Traditional Pedicure',
            description: 'Basic pedicure with traditional polish',
          },
        ],
        prices: [{ amount: 20, duration: 40, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 16,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo fibra',
            description:
              'Refuerzo de uñas naturales con fibra para mayor resistencia',
          },
          {
            language: 'en',
            name: 'Fiber Nail Reinforcement',
            description: 'Natural nail strengthening using fiber',
          },
        ],
        prices: [{ amount: 30, duration: 60, currency: 'EUR' }],
        sedeIds: [1, 3],
      },
      {
        categoryId: 16,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo AIB',
            description:
              'Refuerzo de uñas con técnica AIB para mayor durabilidad',
          },
          {
            language: 'en',
            name: 'AIB Nail Reinforcement',
            description: 'Nail strengthening using AIB technique',
          },
        ],
        prices: [{ amount: 32, duration: 60, currency: 'EUR' }],
        sedeIds: [1, 3],
      },
      {
        categoryId: 16,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo gel constructor',
            description:
              'Refuerzo con gel constructor para dar estructura a la uña',
          },
          {
            language: 'en',
            name: 'Builder Gel Reinforcement',
            description: 'Nail reinforcement using builder gel',
          },
        ],
        prices: [{ amount: 35, duration: 70, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 16,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo BIAB',
            description: 'Refuerzo con BIAB para fortalecer la uña natural',
          },
          {
            language: 'en',
            name: 'BIAB Reinforcement',
            description: 'Builder in a bottle nail strengthening treatment',
          },
        ],
        prices: [{ amount: 33, duration: 65, currency: 'EUR' }],
        sedeIds: [1, 3],
      },

      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Uñas nuevas tamaño Max No2',
            description: 'Aplicación de uñas acrílicas tamaño máximo No2',
          },
          {
            language: 'en',
            name: 'New Acrylic Nails Max Size No2',
            description: 'Full set acrylic nails max size No2',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Uñas nuevas extra largas',
            description: 'Aplicación de uñas acrílicas extra largas',
          },
          {
            language: 'en',
            name: 'New Extra Long Acrylic Nails',
            description: 'Full set of extra long acrylic nails',
          },
        ],
        prices: [{ amount: 55, duration: 140, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Relleno de uñas',
            description: 'Mantenimiento y relleno de uñas acrílicas',
          },
          {
            language: 'en',
            name: 'Acrylic Nail Refill',
            description: 'Refill maintenance for acrylic nails',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Recubrimiento en uña natural',
            description: 'Aplicación de acrílico sobre uña natural',
          },
          {
            language: 'en',
            name: 'Overlay on Natural Nail',
            description: 'Acrylic overlay on natural nail',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Relleno de uñas extralarga',
            description: 'Relleno para uñas acrílicas extralargas',
          },
          {
            language: 'en',
            name: 'Extra Long Acrylic Refill',
            description: 'Refill for extra long acrylic nails',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Retiro uñas Acrílicas',
            description: 'Retirada de uñas acrílicas',
          },
          {
            language: 'en',
            name: 'Acrylic Nail Removal',
            description: 'Removal of acrylic nails',
          },
        ],
        prices: [{ amount: 11, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Uñas nuevas tamaño max N2',
            description: 'Extensión de uñas en polygel tamaño máximo N2',
          },
          {
            language: 'en',
            name: 'New nails max size N2',
            description: 'Polygel nail extensions up to max size N2',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Uñas nuevas extralargas',
            description: 'Extensión de uñas en polygel extralargas',
          },
          {
            language: 'en',
            name: 'New extra long nails',
            description: 'Extra long polygel nail extensions',
          },
        ],
        prices: [{ amount: 55, duration: 140, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Relleno de uñas',
            description: 'Relleno de crecimiento en uñas de polygel',
          },
          {
            language: 'en',
            name: 'Nail refill',
            description: 'Polygel nail refill maintenance',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Recubrimiento en uña natural',
            description: 'Recubrimiento con polygel sobre la uña natural',
          },
          {
            language: 'en',
            name: 'Natural nail overlay',
            description: 'Polygel overlay on natural nails',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Relleno extralargas',
            description: 'Relleno para uñas extralargas en polygel',
          },
          {
            language: 'en',
            name: 'Extra long refill',
            description: 'Refill for extra long polygel nails',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Retiro uñas Polygel',
            description: 'Retirada de uñas de polygel',
          },
          {
            language: 'en',
            name: 'Polygel nail removal',
            description: 'Removal of polygel nails',
          },
        ],
        prices: [{ amount: 11, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Implementos de asepsia',
            description:
              'Uso de implementos de asepsia (casos como hongo o infección)',
          },
          {
            language: 'en',
            name: 'Asepsis tools',
            description: 'Use of aseptic tools (fungus or infection cases)',
          },
        ],
        prices: [{ amount: 3, duration: 5, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Decoración por uña',
            description: 'Decoración individual por uña',
          },
          {
            language: 'en',
            name: 'Per nail decoration',
            description: 'Decoration per nail',
          },
        ],
        prices: [{ amount: 1, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Decoración completa',
            description: 'Decoración completa con diseños o piedras',
          },
          {
            language: 'en',
            name: 'Full decoration',
            description: 'Full nail decoration with designs or stones',
          },
        ],
        prices: [{ amount: 9, duration: 40, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Kit de manicura',
            description: 'Kit de herramientas de manicura',
          },
          {
            language: 'en',
            name: 'Manicure kit',
            description: 'Manicure tool kit',
          },
        ],
        prices: [{ amount: 5, duration: 5, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Cambio de forma',
            description: 'Cambio de forma de las uñas',
          },
          {
            language: 'en',
            name: 'Shape change',
            description: 'Nail shape change',
          },
        ],
        prices: [{ amount: 5, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Uña rota clienta Glow',
            description: 'Reparación de uña rota para clienta del centro',
          },
          {
            language: 'en',
            name: 'Broken nail (Glow client)',
            description: 'Repair for existing client',
          },
        ],
        prices: [{ amount: 2.5, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Uña rota otro centro',
            description: 'Reparación de uña rota de otro centro',
          },
          {
            language: 'en',
            name: 'Broken nail (other salon)',
            description: 'Repair from another salon',
          },
        ],
        prices: [{ amount: 4, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro semipermanente',
            description: 'Retiro de esmalte semipermanente',
          },
          {
            language: 'en',
            name: 'Semi-permanent removal',
            description: 'Removal of semi-permanent polish',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro refuerzo',
            description: 'Retiro de refuerzo de uñas',
          },
          {
            language: 'en',
            name: 'Reinforcement removal',
            description: 'Removal of nail reinforcement',
          },
        ],
        prices: [{ amount: 7, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Pedicura uñas en acrílico o polygel',
            description:
              'Pedicura con aplicación de uñas en acrílico o polygel',
          },
          {
            language: 'en',
            name: 'Acrylic or Polygel Pedicure',
            description: 'Pedicure with acrylic or polygel nail application',
          },
        ],
        prices: [{ amount: 12, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro de extensión',
            description: 'Retiro de extensiones de uñas',
          },
          {
            language: 'en',
            name: 'Extension removal',
            description: 'Removal of nail extensions',
          },
        ],
        prices: [{ amount: 11, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación Cejas Con hilo',
            description: 'Depilación de cejas con técnica de hilo',
          },
          {
            language: 'en',
            name: 'Eyebrow Threading',
            description: 'Eyebrow hair removal using thread technique',
          },
        ],
        prices: [{ amount: 12, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación Cejas con cera',
            description: 'Depilación de cejas con cera',
          },
          {
            language: 'en',
            name: 'Eyebrow Waxing',
            description: 'Eyebrow hair removal using wax',
          },
        ],
        prices: [{ amount: 10, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Cejas Henna Con Hilo',
            description: 'Diseño de cejas con henna y depilación con hilo',
          },
          {
            language: 'en',
            name: 'Henna Eyebrow Design with Threading',
            description: 'Eyebrow design with henna and threading',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Cejas Henna con Cera',
            description: 'Diseño de cejas con henna y depilación con cera',
          },
          {
            language: 'en',
            name: 'Henna Eyebrow Design with Wax',
            description: 'Eyebrow design with henna and waxing',
          },
        ],
        prices: [{ amount: 19, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación y Mapping de Cejas',
            description: 'Depilación y diseño personalizado de cejas',
          },
          {
            language: 'en',
            name: 'Eyebrow Mapping and Shaping',
            description: 'Custom eyebrow mapping and hair removal',
          },
        ],
        prices: [{ amount: 15, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Henna Cejas',
            description: 'Aplicación de henna en cejas',
          },
          {
            language: 'en',
            name: 'Eyebrow Henna',
            description: 'Henna application on eyebrows',
          },
        ],
        prices: [{ amount: 15, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Tinte Cejas',
            description: 'Tinte para cejas',
          },
          {
            language: 'en',
            name: 'Eyebrow Tint',
            description: 'Eyebrow tinting service',
          },
        ],
        prices: [{ amount: 10, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Laminado y Tinte Cejas',
            description: 'Laminado de cejas con tinte',
          },
          {
            language: 'en',
            name: 'Brow Lamination and Tint',
            description: 'Eyebrow lamination with tint',
          },
        ],
        prices: [{ amount: 37, duration: 45, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Cejas Tinte Con Hilo',
            description: 'Diseño de cejas con tinte y depilación con hilo',
          },
          {
            language: 'en',
            name: 'Eyebrow Design with Tint and Threading',
            description: 'Eyebrow design with tint and threading',
          },
        ],
        prices: [{ amount: 20, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Cejas Tinte con Cera',
            description: 'Diseño de cejas con tinte y depilación con cera',
          },
          {
            language: 'en',
            name: 'Eyebrow Design with Tint and Wax',
            description: 'Eyebrow design with tint and waxing',
          },
        ],
        prices: [{ amount: 18, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Labio Superior',
            description: 'Depilación con cera en labio superior',
          },
          {
            language: 'en',
            name: 'Upper Lip Waxing',
            description: 'Waxing service for upper lip',
          },
        ],
        prices: [{ amount: 6, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Facial Completa',
            description: 'Depilación facial completa con cera',
          },
          {
            language: 'en',
            name: 'Full Face Waxing',
            description: 'Full face waxing service',
          },
        ],
        prices: [{ amount: 20, duration: 30, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Axilas',
            description: 'Depilación con cera en axilas',
          },
          {
            language: 'en',
            name: 'Underarm Waxing',
            description: 'Waxing service for underarms',
          },
        ],
        prices: [{ amount: 8, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Brazos Completos',
            description: 'Depilación con cera en brazos completos',
          },
          {
            language: 'en',
            name: 'Full Arms Waxing',
            description: 'Waxing service for full arms',
          },
        ],
        prices: [{ amount: 18, duration: 45, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Pubis Completo',
            description: 'Depilación con cera en pubis completo',
          },
          {
            language: 'en',
            name: 'Full Bikini Wax',
            description: 'Full pubic waxing service',
          },
        ],
        prices: [{ amount: 20, duration: 20, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Piernas Completas',
            description: 'Depilación con cera en piernas completas',
          },
          {
            language: 'en',
            name: 'Full Legs Waxing',
            description: 'Waxing service for full legs',
          },
        ],
        prices: [{ amount: 20, duration: 30, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Glúteos, Ingles o Bikini',
            description: 'Depilación con cera en glúteos o zona bikini',
          },
          {
            language: 'en',
            name: 'Buttocks or Bikini Wax',
            description: 'Waxing for buttocks or bikini area',
          },
        ],
        prices: [{ amount: 12, duration: 25, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Espalda Media o Abdomen',
            description: 'Depilación con cera en espalda media o abdomen',
          },
          {
            language: 'en',
            name: 'Half Back or Abdomen Wax',
            description: 'Waxing service for mid back or abdomen',
          },
        ],
        prices: [{ amount: 15, duration: 20, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Pubis Completo + Perianal',
            description: 'Depilación completa con zona perianal',
          },
          {
            language: 'en',
            name: 'Full Bikini + Perianal Wax',
            description: 'Full bikini with perianal waxing',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Media Pierna',
            description: 'Depilación con cera en media pierna',
          },
          {
            language: 'en',
            name: 'Half Leg Waxing',
            description: 'Waxing service for half legs',
          },
        ],
        prices: [{ amount: 15, duration: 30, currency: 'EUR' }],
        sedeIds: [1, 2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Hombre Espalda Completa',
            description: 'Depilación con cera en espalda completa para hombre',
          },
          {
            language: 'en',
            name: 'Men Full Back Waxing',
            description: 'Full back waxing service for men',
          },
        ],
        prices: [{ amount: 35, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Pecho Hombre',
            description: 'Depilación con cera en pecho para hombre',
          },
          {
            language: 'en',
            name: 'Men Chest Waxing',
            description: 'Chest waxing service for men',
          },
        ],
        prices: [{ amount: 16, duration: 20, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Ingles Normales',
            description: 'Depilación con cera en ingles normales',
          },
          {
            language: 'en',
            name: 'Basic Bikini Wax',
            description: 'Basic bikini waxing service',
          },
        ],
        prices: [{ amount: 11, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Mentón',
            description: 'Depilación con cera en mentón',
          },
          {
            language: 'en',
            name: 'Chin Waxing',
            description: 'Waxing service for chin',
          },
        ],
        prices: [{ amount: 4, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Pómulos',
            description: 'Depilación con cera en pómulos',
          },
          {
            language: 'en',
            name: 'Cheek Waxing',
            description: 'Waxing service for cheeks',
          },
        ],
        prices: [{ amount: 4, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Medio Brazo',
            description: 'Depilación con cera en medio brazo',
          },
          {
            language: 'en',
            name: 'Half Arm Waxing',
            description: 'Waxing service for half arm',
          },
        ],
        prices: [{ amount: 9, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Fosas Nasales',
            description: 'Depilación con cera en fosas nasales',
          },
          {
            language: 'en',
            name: 'Nose Waxing',
            description: 'Waxing service for nose',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Cera Cuerpo Completo Mujer',
            description: 'Depilación con cera en todo el cuerpo para mujer',
          },
          {
            language: 'en',
            name: 'Full Body Waxing Women',
            description: 'Full body waxing service for women',
          },
        ],
        prices: [{ amount: 58, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Cera Cuerpo Completo Hombre',
            description: 'Depilación con cera en todo el cuerpo para hombre',
          },
          {
            language: 'en',
            name: 'Full Body Waxing Men',
            description: 'Full body waxing service for men',
          },
        ],
        prices: [{ amount: 90, duration: 120, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Con Cera Orejas',
            description: 'Depilación con cera en orejas',
          },
          {
            language: 'en',
            name: 'Ear Waxing',
            description: 'Waxing service for ears',
          },
        ],
        prices: [{ amount: null, duration: null, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Hilo Mentón',
            description: 'Depilación con hilo en mentón',
          },
          {
            language: 'en',
            name: 'Chin Threading',
            description: 'Threading service for chin',
          },
        ],
        prices: [{ amount: 6, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 3, 4],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Hilo Labio Superior',
            description: 'Depilación con hilo en labio superior',
          },
          {
            language: 'en',
            name: 'Upper Lip Threading',
            description: 'Threading service for upper lip',
          },
        ],
        prices: [{ amount: 7, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 3],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Hilo Facial Completa',
            description:
              'Depilación con hilo en frente, cejas, pómulos, patillas, labio superior y mentón',
          },
          {
            language: 'en',
            name: 'Full Face Threading',
            description:
              'Threading for forehead, eyebrows, cheeks, sideburns, upper lip and chin',
          },
        ],
        prices: [{ amount: 30, duration: 45, currency: 'EUR' }],
        sedeIds: [1, 3, 4],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Hilo Pómulos',
            description: 'Depilación con hilo en pómulos',
          },
          {
            language: 'en',
            name: 'Cheek Threading',
            description: 'Threading service for cheeks',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 4],
      },

      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Lifting y tinte de pestañas',
            description: 'Servicio de lifting y tinte para pestañas',
          },
          {
            language: 'en',
            name: 'Lash Lift and Tint',
            description: 'Lifting and tinting service for eyelashes',
          },
        ],
        prices: [{ amount: 36, duration: 45, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Cuerpo Completo mujer',
            description: 'Depilación láser cuerpo completo para mujer',
          },
          {
            language: 'en',
            name: 'Full Body Laser Women',
            description: 'Full body laser hair removal for women',
          },
        ],
        prices: [{ amount: 60, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona S',
            description:
              'Axilas, labio superior, manos, pies, línea alba, pómulos, mentón, aureolas, nuca, patillas, bajo glúteo',
          },
          {
            language: 'en',
            name: 'Laser Small Area',
            description:
              'Small laser areas like armpits, upper lip, hands, etc',
          },
        ],
        prices: [{ amount: 6, duration: 10, currency: 'EUR' }],
        sedeIds: [1, 4],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona M',
            description: 'Pubis, ingles, perianal, medio brazo, hombros',
          },
          {
            language: 'en',
            name: 'Laser Medium Area',
            description: 'Medium areas like pubis, groin, shoulders',
          },
        ],
        prices: [{ amount: 15, duration: 20, currency: 'EUR' }],
        sedeIds: [1, 4],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona L',
            description:
              'Media pierna, brazos, glúteos, pecho, abdomen, media espalda, zona íntima completa',
          },
          {
            language: 'en',
            name: 'Laser Large Area',
            description: 'Large areas like legs, arms, chest, abdomen',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [1, 4],
      },
      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona XL',
            description: 'Piernas completas o espalda',
          },
          {
            language: 'en',
            name: 'Laser Extra Large Area',
            description: 'Extra large areas like full legs or back',
          },
        ],
        prices: [{ amount: 36, duration: 45, currency: 'EUR' }],
        sedeIds: [1, 4],
      },

      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona S Hombre',
            description:
              'Axilas, labio superior, manos, pies, línea alba, pómulos, mentón, aureolas, nuca, patillas, bajo glúteo',
          },
          {
            language: 'en',
            name: 'Laser Small Area Men',
            description: 'Small laser areas for men',
          },
        ],
        prices: [{ amount: 10, duration: 10, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona M Hombre',
            description: 'Pubis, ingles, perianal, medio brazo, hombros',
          },
          {
            language: 'en',
            name: 'Laser Medium Area Men',
            description: 'Medium areas for men',
          },
        ],
        prices: [{ amount: 20, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona L Hombre',
            description:
              'Media pierna, brazos, glúteos, pecho, abdomen, media espalda, zona íntima completa',
          },
          {
            language: 'en',
            name: 'Laser Large Area Men',
            description: 'Large areas for men',
          },
        ],
        prices: [{ amount: 30, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Cuerpo Completo Hombre',
            description: 'Depilación láser cuerpo completo para hombre',
          },
          {
            language: 'en',
            name: 'Full Body Laser Men',
            description: 'Full body laser hair removal for men',
          },
        ],
        prices: [{ amount: 100, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona XL Hombre',
            description: 'Piernas completas o espalda',
          },
          {
            language: 'en',
            name: 'Laser Extra Large Area Men',
            description: 'Extra large areas for men',
          },
        ],
        prices: [{ amount: 40, duration: 45, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 17,
        translations: [
          {
            language: 'es',
            name: 'Limpieza facial profunda con extracción',
            description: 'Limpieza facial profunda con extracción',
          },
          {
            language: 'en',
            name: 'Deep Facial Cleansing with Extraction',
            description: 'Deep facial cleansing with extraction',
          },
        ],
        prices: [{ amount: 51, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 17,
        translations: [
          {
            language: 'es',
            name: 'Higiene Facial con Hidratación (sin extracción)',
            description: 'Higiene facial con hidratación sin extracción',
          },
          {
            language: 'en',
            name: 'Facial Hygiene with Hydration (no extraction)',
            description: 'Facial hygiene with hydration without extraction',
          },
        ],
        prices: [{ amount: 32, duration: 45, currency: 'EUR' }],
        sedeIds: [1, 2],
      },

      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'Dermapen',
            description: 'Tratamiento facial con Dermapen',
          },
          {
            language: 'en',
            name: 'Dermapen',
            description: 'Facial treatment with Dermapen',
          },
        ],
        prices: [{ amount: 60, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'Dermapen Labios y Ojeras',
            description: 'Tratamiento Dermapen para labios y ojeras',
          },
          {
            language: 'en',
            name: 'Dermapen Lips and Dark Circles',
            description: 'Dermapen treatment for lips and under eyes',
          },
        ],
        prices: [{ amount: 30, duration: 30, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'BONO 4 SESIONES DERMAPEN.',
            description: 'Bono de 4 sesiones de Dermapen',
          },
          {
            language: 'en',
            name: 'Dermapen 4 Sessions Package',
            description: 'Package of 4 Dermapen sessions',
          },
        ],
        prices: [{ amount: 200, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo Fibra',
            description: 'Refuerzo de uñas con técnica de fibra',
          },
          {
            language: 'en',
            name: 'Fiber Reinforcement',
            description: 'Nail reinforcement using fiber technique',
          },
        ],
        prices: [{ amount: 30, duration: 70, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo AIB',
            description: 'Refuerzo de uñas con sistema AIB',
          },
          {
            language: 'en',
            name: 'AIB Reinforcement',
            description: 'Nail reinforcement with AIB system',
          },
        ],
        prices: [{ amount: 33, duration: 75, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo Gel Constructor',
            description: 'Refuerzo de uñas con gel constructor',
          },
          {
            language: 'en',
            name: 'Builder Gel Reinforcement',
            description: 'Nail reinforcement using builder gel',
          },
        ],
        prices: [{ amount: 33, duration: 75, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo BIAB',
            description: 'Refuerzo de uñas con sistema BIAB',
          },
          {
            language: 'en',
            name: 'BIAB Reinforcement',
            description: 'Nail reinforcement using BIAB system',
          },
        ],
        prices: [{ amount: 33, duration: 75, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Semipermanente SPA',
            description:
              'Tratamiento completo de pies con esmaltado semipermanente y masaje relajante',
          },
          {
            language: 'en',
            name: 'SPA Semi-Permanent Pedicure',
            description:
              'Full foot treatment with semi-permanent polish and relaxing massage',
          },
        ],
        prices: [{ amount: 36, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Esmaltado tradicional SPA',
            description:
              'Tratamiento completo de pies con esmaltado tradicional',
          },
          {
            language: 'en',
            name: 'SPA Traditional Pedicure',
            description: 'Full foot treatment with traditional nail polish',
          },
        ],
        prices: [{ amount: 26, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Semipermanente Jelly',
            description:
              'Pedicura con esmaltado semipermanente y tratamiento Jelly',
          },
          {
            language: 'en',
            name: 'Jelly Semi-Permanent Pedicure',
            description:
              'Pedicure with semi-permanent polish and jelly treatment',
          },
        ],
        prices: [{ amount: 41, duration: 90, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Uñas Acrílico o Polygel Pies',
            description: 'Aplicación de acrílico o polygel en uñas de los pies',
          },
          {
            language: 'en',
            name: 'Acrylic or Polygel Toenails',
            description: 'Application of acrylic or polygel on toenails',
          },
        ],
        prices: [{ amount: 12, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Esmaltado Tradicional Hombre',
            description:
              'Tratamiento completo de pies con esmaltado tradicional para hombre',
          },
          {
            language: 'en',
            name: 'Men Traditional Pedicure',
            description: 'Full foot treatment with traditional polish for men',
          },
        ],
        prices: [{ amount: 30, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Uñas Nuevas Acrílicas Tamaño Max N-2.',
            description: 'set new nails/ builder nails',
          },
          {
            language: 'en',
            name: 'New Acrylic Nails Max Size N-2',
            description: 'Set of new builder nails',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Uñas Nuevas Acrílicas Extra Largas',
            description: '',
          },
          {
            language: 'en',
            name: 'Extra Long New Acrylic Nails',
            description: '',
          },
        ],
        prices: [{ amount: 55, duration: 140, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Relleno de uñas Acrílicas',
            description: '',
          },
          {
            language: 'en',
            name: 'Acrylic Nail Refill',
            description: '',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Relleno de Uñas ExtraLargas Acrílicas',
            description: '',
          },
          {
            language: 'en',
            name: 'Extra Long Acrylic Nail Refill',
            description: '',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Recubrimiento en Acrílico Uña Natural',
            description: '',
          },
          {
            language: 'en',
            name: 'Acrylic Overlay on Natural Nail',
            description: '',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Retiro Uñas Acrílicas',
            description: '',
          },
          {
            language: 'en',
            name: 'Acrylic Nail Removal',
            description: '',
          },
        ],
        prices: [{ amount: 11, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Uñas Nuevas Tamaño Max N2',
            description: '',
          },
          {
            language: 'en',
            name: 'New Nails Max Size N2',
            description: '',
          },
        ],
        prices: [{ amount: 47, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Uñas Nuevas Extra Largas',
            description: '',
          },
          {
            language: 'en',
            name: 'Extra Long New Nails',
            description: '',
          },
        ],
        prices: [{ amount: 55, duration: 140, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Relleno De uñas',
            description: '',
          },
          {
            language: 'en',
            name: 'Nail Refill',
            description: '',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Relleno Extra Largas',
            description: '',
          },
          {
            language: 'en',
            name: 'Extra Long Nail Refill',
            description: '',
          },
        ],
        prices: [{ amount: 47, duration: 150, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Recubrimiento en uña Natural',
            description: '',
          },
          {
            language: 'en',
            name: 'Overlay on Natural Nail',
            description: '',
          },
        ],
        prices: [{ amount: 36, duration: 90, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Implementos de asepsia',
            description:
              'Elemento desechable para clientes con hongo o infección',
          },
          {
            language: 'en',
            name: 'Asepsis tools',
            description:
              'Disposable tools for clients with fungus or infection',
          },
        ],
        prices: [{ amount: 3, duration: 5, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Decoración por uña',
            description: 'Decoración individual por cada uña',
          },
          {
            language: 'en',
            name: 'Per nail decoration',
            description: 'Decoration per nail',
          },
        ],
        prices: [{ amount: 1, duration: 10, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Decoración completa',
            description: 'Decoración en varias uñas con diseños o pedrería',
          },
          {
            language: 'en',
            name: 'Full decoration',
            description: 'Full nail decoration with designs or rhinestones',
          },
        ],
        prices: [{ amount: 9, duration: 40, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Kit de manicura',
            description: 'Kit de herramientas para manicura',
          },
          {
            language: 'en',
            name: 'Manicure kit',
            description: 'Manicure tools kit',
          },
        ],
        prices: [{ amount: 5, duration: 5, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Cambio de forma',
            description: 'Cambio en la forma de la uña',
          },
          {
            language: 'en',
            name: 'Shape change',
            description: 'Change of nail shape',
          },
        ],
        prices: [{ amount: 5, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro semipermanente',
            description: 'Retiro de esmalte semipermanente',
          },
          {
            language: 'en',
            name: 'Semi-permanent removal',
            description: 'Removal of semi-permanent polish',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro refuerzo',
            description: 'Retiro de refuerzo en uñas',
          },
          {
            language: 'en',
            name: 'Reinforcement removal',
            description: 'Removal of nail reinforcement',
          },
        ],
        prices: [{ amount: 7, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Retiro extensión',
            description: 'Retiro de uñas de extensión',
          },
          {
            language: 'en',
            name: 'Extension removal',
            description: 'Removal of nail extensions',
          },
        ],
        prices: [{ amount: 11, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Uña rota clienta Glow',
            description: 'Reparación de uña rota para clientas del centro',
          },
          {
            language: 'en',
            name: 'Broken nail (Glow client)',
            description: 'Broken nail repair for salon clients',
          },
        ],
        prices: [{ amount: 2.5, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Uña rota de otro centro',
            description: 'Reparación de uña rota de otro centro',
          },
          {
            language: 'en',
            name: 'Broken nail (other salon)',
            description: 'Broken nail repair from another salon',
          },
        ],
        prices: [{ amount: 4, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Extra durezas pedicura',
            description: 'Eliminación adicional de durezas en pedicura',
          },
          {
            language: 'en',
            name: 'Extra callus removal',
            description: 'Additional callus removal in pedicure',
          },
        ],
        prices: [{ amount: 4, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Baby boomer',
            description: 'Efecto degradado estilo baby boomer',
          },
          {
            language: 'en',
            name: 'Baby boomer',
            description: 'Baby boomer gradient effect',
          },
        ],
        prices: [{ amount: 4, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Adicional manicura rusa con refuerzo',
            description: 'Extra en manicura rusa con refuerzo',
          },
          {
            language: 'en',
            name: 'Russian manicure reinforcement add-on',
            description: 'Additional reinforcement for Russian manicure',
          },
        ],
        prices: [{ amount: 7, duration: 10, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Efecto ojo de gato',
            description: 'Efecto magnético tipo ojo de gato',
          },
          {
            language: 'en',
            name: 'Cat eye effect',
            description: 'Magnetic cat eye nail effect',
          },
        ],
        prices: [{ amount: 5, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Efecto aurora',
            description: 'Efecto brillo tipo aurora',
          },
          {
            language: 'en',
            name: 'Aurora effect',
            description: 'Aurora shine effect',
          },
        ],
        prices: [{ amount: 5, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación con hilo',
            description: '',
          },
          {
            language: 'en',
            name: 'Threading',
            description: '',
          },
        ],
        prices: [{ amount: 12, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación con Cera',
            description: '',
          },
          {
            language: 'en',
            name: 'Waxing',
            description: '',
          },
        ],
        prices: [{ amount: 10, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Henna con Hilo',
            description: '',
          },
          {
            language: 'en',
            name: 'Henna Design with Threading',
            description: '',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Diseño Henna con Cera',
            description: '',
          },
          {
            language: 'en',
            name: 'Henna Design with Wax',
            description: '',
          },
        ],
        prices: [{ amount: 19, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Depilación y Mapping de cejas',
            description: '',
          },
          {
            language: 'en',
            name: 'Eyebrow Mapping and Waxing',
            description: '',
          },
        ],
        prices: [{ amount: 15, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Henna Cejas',
            description: '',
          },
          {
            language: 'en',
            name: 'Henna Brows',
            description: '',
          },
        ],
        prices: [{ amount: 15, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Tinte Cejas',
            description: '',
          },
          {
            language: 'en',
            name: 'Eyebrow Tint',
            description: '',
          },
        ],
        prices: [{ amount: 10, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Laminado y Tinte Cejas',
            description: 'Incluye diseño, depilación y color',
          },
          {
            language: 'en',
            name: 'Brow Lamination with Tint',
            description: 'Includes design, shaping and color',
          },
        ],
        prices: [{ amount: 37, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas híbridas',
            description: 'Servicio de extensiones de pestañas híbridas',
          },
          {
            language: 'en',
            name: 'Hybrid Lashes',
            description: 'Hybrid eyelash extensions service',
          },
        ],
        prices: [{ amount: 61, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Relleno pestañas híbridas',
            description: 'Mantenimiento y relleno de pestañas híbridas',
          },
          {
            language: 'en',
            name: 'Hybrid Lashes Infill',
            description: 'Maintenance and refill for hybrid lashes',
          },
        ],
        prices: [{ amount: 51, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas 2D y 3D',
            description: 'Extensiones de pestañas con volumen 2D y 3D',
          },
          {
            language: 'en',
            name: '2D and 3D Lashes',
            description: '2D and 3D volume eyelash extensions',
          },
        ],
        prices: [{ amount: 61, duration: 135, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Relleno pestañas 2D y 3D',
            description: 'Relleno para extensiones 2D y 3D',
          },
          {
            language: 'en',
            name: '2D and 3D Lashes Infill',
            description: 'Infill for 2D and 3D extensions',
          },
        ],
        prices: [{ amount: 51, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas volumen Ruso',
            description: 'Extensiones de pestañas técnica Volumen Ruso',
          },
          {
            language: 'en',
            name: 'Russian Volume Lashes',
            description: 'Russian Volume technique eyelash extensions',
          },
        ],
        prices: [{ amount: 71, duration: 135, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Relleno pestañas volumen Ruso',
            description: 'Relleno para técnica de Volumen Ruso',
          },
          {
            language: 'en',
            name: 'Russian Volume Infill',
            description: 'Infill for Russian Volume technique',
          },
        ],
        prices: [{ amount: 61, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas lifting y tinte',
            description: 'Lifting de pestañas naturales con tinte incluido',
          },
          {
            language: 'en',
            name: 'Lash Lifting and Tint',
            description: 'Natural lash lift including tint',
          },
        ],
        prices: [{ amount: 35, duration: 60, currency: 'EUR' }],
        sedeIds: [2, 4],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Retiro de Pestañas',
            description: 'Retirada segura de extensiones de pestañas',
          },
          {
            language: 'en',
            name: 'Lash Removal',
            description: 'Safe removal of eyelash extensions',
          },
        ],
        prices: [{ amount: 11, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Tinte pestañas',
            description: 'Servicio de coloración para pestañas',
          },
          {
            language: 'en',
            name: 'Lash Tint',
            description: 'Eyelash tinting service',
          },
        ],
        prices: [{ amount: 13, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Clásicas',
            description:
              'Extensiones de pestañas técnica clásica (pelo a pelo)',
          },
          {
            language: 'en',
            name: 'Classic Lashes',
            description: 'Classic technique eyelash extensions (one by one)',
          },
        ],
        prices: [{ amount: 51, duration: 120, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 17,
        translations: [
          {
            language: 'es',
            name: 'Higiene facial profunda con Hidratación',
            description:
              'Limpieza facial profunda con tratamiento de hidratación intensiva',
          },
          {
            language: 'en',
            name: 'Deep Facial Cleansing with Hydration',
            description:
              'Deep facial cleansing with intensive hydration treatment',
          },
        ],
        prices: [{ amount: 60, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },

      {
        id_existente_en_memoria: 'Higiene facial con hidratación',
        sedeIds: [2],
      },

      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Mentón con Hilo',
            description:
              'Eliminación de vello en el mentón mediante técnica de hilo',
          },
          {
            language: 'en',
            name: 'Chin Threading',
            description:
              'Hair removal from the chin area using threading technique',
          },
        ],
        prices: [{ amount: 6, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Labio Superior con Hilo',
            description: 'Depilación de labio superior con técnica de hilo',
          },
          {
            language: 'en',
            name: 'Upper Lip Threading',
            description: 'Upper lip hair removal using threading technique',
          },
        ],
        prices: [{ amount: 7, duration: 15, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Facial completa con Hilo',
            description: 'Depilación de rostro completo con técnica de hilo',
          },
          {
            language: 'en',
            name: 'Full Face Threading',
            description: 'Full face hair removal using threading technique',
          },
        ],
        prices: [{ amount: 30, duration: 45, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Depilación Pomulos con Hilo',
            description:
              'Eliminación de vello en los pómulos mediante técnica de hilo',
          },
          {
            language: 'en',
            name: 'Cheeks Threading',
            description:
              'Hair removal from the cheeks area using threading technique',
          },
        ],
        prices: [{ amount: 5, duration: 10, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación con cera Zona íntima Completa',
            description: 'Depilación con cera en zona íntima completa',
          },
          {
            language: 'en',
            name: 'Full Intimate Waxing',
            description: 'Full intimate area waxing service',
          },
        ],
        prices: [{ amount: 31, duration: 55, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación con cera Cuerpo Completo',
            description:
              'Incluye (piernas completas, Ingles, zona intima completa y axilas).',
          },
          {
            language: 'en',
            name: 'Full Body Waxing',
            description:
              'Includes (full legs, bikini line, full intimate area and underarms).',
          },
        ],
        prices: [{ amount: 58, duration: 80, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación con cera nariz',
            description: 'Depilación con cera en zona de la nariz',
          },
          {
            language: 'en',
            name: 'Nose Waxing',
            description: 'Waxing service for nose hair',
          },
        ],
        prices: [{ amount: 4, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación Espalda',
            description:
              'Depilación con cera en zona de la espalda para hombre',
          },
          {
            language: 'en',
            name: "Men's Back Waxing",
            description: 'Back waxing service for men',
          },
        ],
        prices: [{ amount: 35, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Depilación pecho',
            description: 'Depilación con cera en zona del pecho para hombre',
          },
          {
            language: 'en',
            name: "Men's Chest Waxing",
            description: 'Chest waxing service for men',
          },
        ],
        prices: [{ amount: 35, duration: 45, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 3,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona S',
            description:
              'Axilas, labio superior, manos, pies, línea alba, pómulos, mentón, aureolas, nuca, patillas, bajo glúteo.',
          },
          {
            language: 'en',
            name: 'Laser Zone S',
            description:
              'Underarms, upper lip, hands, feet, linea alba, cheekbones, chin, areolas, nape, sideburns, lower buttocks.',
          },
        ],
        prices: [{ amount: 6, duration: 10, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 3,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona M',
            description: 'Pubis, ingles, perianal, medio brazo, hombros.',
          },
          {
            language: 'en',
            name: 'Laser Zone M',
            description: 'Pubis, bikini line, perianal, half arm, shoulders.',
          },
        ],
        prices: [{ amount: 15, duration: 20, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 3,
        translations: [
          {
            language: 'es',
            name: 'Laser Zona L',
            description:
              'Media pierna, brazos, glúteos, pecho, abdomen, media espalda, zona íntima completa.',
          },
          {
            language: 'en',
            name: 'Laser Zone L',
            description:
              'Half leg, full arms, buttocks, chest, abdomen, mid back, full intimate area.',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 14,
        translations: [
          {
            language: 'es',
            name: 'RESET - Individual',
            description:
              'Ritual de Head Spa diseñado para liberar tensiones. Incluye lavado purificador, hidroterapia, masaje craneal y facial, aromaterapia y sonoterapia.',
          },
          {
            language: 'en',
            name: 'RESET - Individual',
            description:
              'Head Spa ritual designed to release tension. Includes purifying wash, hydrotherapy, cranial and facial massage, aromatherapy, and sound therapy.',
          },
        ],
        prices: [{ amount: 56, duration: 65, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 14,
        translations: [
          {
            language: 'es',
            name: 'RESET - Dos personas simultáneas',
            description:
              'Experiencia sensorial profunda en pareja para liberar tensiones y reconectar.',
          },
          {
            language: 'en',
            name: 'RESET - Two people simultaneous',
            description:
              'Deep sensory experience for couples to release tension and reconnect.',
          },
        ],
        prices: [{ amount: 104, duration: 65, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 14,
        translations: [
          {
            language: 'es',
            name: 'HARMONY PARA DOS',
            description:
              'Ritual en pareja en cabina compartida. Incluye exfoliación capilar, tratamiento facial completo, Shirodhara adaptado, sonoterapia y secado profesional.',
          },
          {
            language: 'en',
            name: 'HARMONY FOR TWO',
            description:
              "Couple's ritual in a shared cabin. Includes hair exfoliation, full facial treatment, adapted Shirodhara, sound therapy, and professional blow-dry.",
          },
        ],
        prices: [{ amount: 160, duration: 95, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 14,
        translations: [
          {
            language: 'es',
            name: 'SUPREME - Individual',
            description:
              'Experiencia premium: masaje con piedras calientes, Head Spa completo, hidroterapia, facial lifting japonés, reflexología podal y secado profesional.',
          },
          {
            language: 'en',
            name: 'SUPREME - Individual',
            description:
              'Premium experience: hot stone massage, full Head Spa, hydrotherapy, Japanese lifting facial, foot reflexology, and professional blow-dry.',
          },
        ],
        prices: [{ amount: 104, duration: 105, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 14,
        translations: [
          {
            language: 'es',
            name: 'SUPREME - Dos personas simultáneas',
            description:
              'Versión para dos personas de nuestra experiencia premium de desconexión total.',
          },
          {
            language: 'en',
            name: 'SUPREME - Two people simultaneous',
            description:
              'Two-person version of our premium total disconnection experience.',
          },
        ],
        prices: [{ amount: 192, duration: 105, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Detox Individual',
            description:
              'Ritual revitalizante que incluye masaje aromático, exfoliación profunda, toallas calientes, barro reafirmante y masaje nutritivo final.',
          },
          {
            language: 'en',
            name: 'Individual Detox Massage',
            description:
              'Revitalizing ritual including aromatic massage, deep exfoliation, hot towels, firming mud, and a final nourishing massage.',
          },
        ],
        prices: [{ amount: 95, duration: 75, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Detox en Pareja',
            description:
              'Ritual revitalizante detox diseñado para disfrutar la experiencia en pareja.',
          },
          {
            language: 'en',
            name: "Couple's Detox Massage",
            description:
              'Revitalizing detox ritual designed to enjoy the experience as a couple.',
          },
        ],
        prices: [{ amount: 108, duration: 75, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Relajante Individual',
            description:
              'Masaje con aceites aromáticos y técnicas suaves para aliviar tensiones y calmar la mente.',
          },
          {
            language: 'en',
            name: 'Individual Relaxing Massage',
            description:
              'Massage with aromatic oils and gentle techniques to relieve tension and calm the mind.',
          },
        ],
        prices: [{ amount: 60, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Relajante - Dos personas simultáneas',
            description:
              'Experiencia en pareja con dos terapeutas en sincronía para una desconexión absoluta en un ambiente armonioso.',
          },
          {
            language: 'en',
            name: 'Relaxing Massage - Two people simultaneous',
            description:
              "Couple's experience with two therapists in sync for absolute disconnection in a harmonious environment.",
          },
        ],
        prices: [{ amount: 110, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Balinés con Aceites Esenciales - Individual',
            description:
              'Combina digitopresión, estiramientos suaves y aceites personalizados para revitalizar el cuerpo y serenar la mente.',
          },
          {
            language: 'en',
            name: 'Individual Balinese Massage with Essential Oils',
            description:
              'Combines acupressure, gentle stretching, and personalized oils to revitalize the body and soothe the mind.',
          },
        ],
        prices: [{ amount: 85, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Balinés con Aceites Esenciales - Dos personas simultáneamente',
            description:
              'Tratamiento inspirado en tradiciones curativas de Bali para compartir simultáneamente.',
          },
          {
            language: 'en',
            name: 'Balinese Massage with Essential Oils - Two people simultaneously',
            description:
              'Treatment inspired by Balinese healing traditions to share simultaneously.',
          },
        ],
        prices: [{ amount: 150, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Piedras Calientes Individual',
            description:
              'Terapia que utiliza el calor de las piedras para relajar la musculatura y equilibrar la energía corporal.',
          },
          {
            language: 'en',
            name: 'Individual Hot Stone Massage',
            description:
              'Therapy using the heat of stones to relax muscles and balance body energy.',
          },
        ],
        prices: [{ amount: 60, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Piedras Calientes - Dos personas simultáneas',
            description:
              'Masaje con piedras calientes realizado de forma simultánea para dos personas.',
          },
          {
            language: 'en',
            name: 'Hot Stone Massage - Two people simultaneous',
            description:
              'Hot stone massage performed simultaneously for two people.',
          },
        ],
        prices: [{ amount: 110, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Masaje Piedras Calientes - Individual',
            description:
              'Masaje con piedras calientes realizado de forma simultánea para dos personas.',
          },
          {
            language: 'en',
            name: 'Hot Stone Massage - Individual',
            description:
              'Hot stone massage performed simultaneously for two people.',
          },
        ],
        prices: [{ amount: 60, duration: 60, currency: 'EUR' }],
        sedeIds: [2],
      },

      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Lavar y Orear Corto',
            description:
              'Servicio de lavado de cabello corto seguido de un secado rápido (oreado).',
          },
          {
            language: 'en',
            name: 'Wash and Quick Dry Short',
            description: 'Short hair wash followed by a quick blow-dry.',
          },
        ],
        prices: [{ amount: 14, duration: 40, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Lavar y Orear Medio',
            description:
              'Lavado para cabello de longitud media con secado oreado.',
          },
          {
            language: 'en',
            name: 'Wash and Quick Dry Medium',
            description: 'Medium hair wash and quick blow-dry.',
          },
        ],
        prices: [{ amount: 16, duration: 45, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Lavar y Orear Largo',
            description: 'Lavado de cabello largo con acabado oreado.',
          },
          {
            language: 'en',
            name: 'Wash and Quick Dry Long',
            description: 'Long hair wash and quick blow-dry.',
          },
        ],
        prices: [{ amount: 18, duration: 45, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Cabello Medio Cepillado y Planchado/Ondas',
            description:
              'Peinado completo para cabello medio que incluye cepillado y acabado con plancha u ondas. Precio desde 27€ según diagnóstico.',
          },
          {
            language: 'en',
            name: 'Medium Hair Brushing & Flat Iron/Waves',
            description:
              'Complete styling for medium hair including brushing and flat iron or waves finish. Price from €27 depending on diagnosis.',
          },
        ],
        prices: [{ amount: 27, duration: 80, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Cabello Largo Cepillado Y Planchado/Ondas',
            description:
              'Peinado para cabello largo con cepillado profesional y acabado liso u ondas. Precio desde 37€ según diagnóstico.',
          },
          {
            language: 'en',
            name: 'Long Hair Brushing & Flat Iron/Waves',
            description:
              'Professional styling for long hair including brushing and flat iron or waves finish. Price from €37 depending on diagnosis.',
          },
        ],
        prices: [{ amount: 37, duration: 100, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Cabello Extra-Largo Cepillado Y Planchado/Ondas',
            description:
              'Peinado para melenas extra largas con cepillado y plancha u ondas. Precio desde 47€ según diagnóstico.',
          },
          {
            language: 'en',
            name: 'Extra-Long Hair Brushing & Flat Iron/Waves',
            description:
              'Styling for extra-long hair including brushing and flat iron or waves. Price from €47 depending on diagnosis.',
          },
        ],
        prices: [{ amount: 47, duration: 115, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Trenza Glow Con Charms',
            description:
              'Peinado con trenza estilo Glow decorada con charms (por unidad).',
          },
          {
            language: 'en',
            name: 'Glow Braid with Charms',
            description:
              'Glow-style braid styling decorated with charms (per unit).',
          },
        ],
        prices: [{ amount: 12, duration: 25, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Lavado de cabello',
            description:
              'Lavado con productos Kerastase y masaje capilar incluido.',
          },
          {
            language: 'en',
            name: 'Hair Wash',
            description:
              'Wash with Kerastase products and hair massage included.',
          },
        ],
        prices: [{ amount: 10, duration: 20, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Mascarilla Repolarizadora',
            description:
              'Tratamiento hidratante intensivo para restaurar la salud del cabello.',
          },
          {
            language: 'en',
            name: 'Repolarizing Mask',
            description:
              'Intensive moisturizing treatment to restore hair health.',
          },
        ],
        prices: [{ amount: 8, duration: 5, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Ritual Fusio Dose',
            description:
              'Tratamiento personalizado de Kerastase para necesidades específicas del cabello.',
          },
          {
            language: 'en',
            name: 'Fusio Dose Ritual',
            description:
              'Customized Kerastase treatment for specific hair needs.',
          },
        ],
        prices: [{ amount: 18, duration: 30, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Adicional Extensiones',
            description:
              'Suplemento por trabajo adicional en cabello con extensiones.',
          },
          {
            language: 'en',
            name: 'Extensions Additional',
            description: 'Surcharge for extra work on hair with extensions.',
          },
        ],
        prices: [{ amount: 15, duration: 15, currency: 'EUR' }],
        sedeIds: [3],
      },
      {
        categoryId: 12,
        translations: [
          {
            language: 'es',
            name: 'Cargo Extra',
            description:
              'Cargo adicional por servicios o productos especiales.',
          },
          {
            language: 'en',
            name: 'Extra Charge',
            description: 'Additional charge for special services or products.',
          },
        ],
        prices: [{ amount: 1, duration: 5, currency: 'EUR' }],
        sedeIds: [3],
      },

      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Relleno 2D y 3D',
            description:
              'Mantenimiento y relleno para extensiones de pestañas con técnica 2D y 3D.',
          },
          {
            language: 'en',
            name: '2D & 3D Lash Refill',
            description:
              'Maintenance and refill for 2D and 3D eyelash extensions.',
          },
        ],
        prices: [{ amount: 51, duration: 120, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Volumen Ruso',
            description:
              'Aplicación de extensiones de pestañas con técnica de volumen ruso.',
          },
          {
            language: 'en',
            name: 'Russian Volume Lashes',
            description:
              'Eyelash extensions application using Russian volume technique.',
          },
        ],
        prices: [{ amount: 71, duration: 135, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Relleno Volumen Ruso',
            description:
              'Servicio de relleno para mantener el efecto de volumen ruso.',
          },
          {
            language: 'en',
            name: 'Russian Volume Lash Refill',
            description:
              'Refill service to maintain the Russian volume effect.',
          },
        ],
        prices: [{ amount: 61, duration: 135, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Lifting y tinte',
            description:
              'Tratamiento de elevación y color para pestañas naturales.',
          },
          {
            language: 'en',
            name: 'Lash Lifting and Tint',
            description: 'Lifting and color treatment for natural eyelashes.',
          },
        ],
        prices: [{ amount: 35, duration: 60, currency: 'EUR' }],
        sedeIds: [1, 3, 4],
      },
      {
        categoryId: 15,
        translations: [
          {
            language: 'es',
            name: 'Pestañas Tinte',
            description:
              'Aplicación de tinte específico para resaltar las pestañas.',
          },
          {
            language: 'en',
            name: 'Lash Tint',
            description:
              'Specific tint application to highlight the eyelashes.',
          },
        ],
        prices: [{ amount: 13, duration: 20, currency: 'EUR' }],
        sedeIds: [4],
      },

      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Cejas Depilación con Hilo',
            description:
              'Diseño y limpieza de cejas utilizando la técnica de hilo.',
          },
          {
            language: 'en',
            name: 'Eyebrow Threading',
            description:
              'Eyebrow shaping and cleaning using threading technique.',
          },
        ],
        prices: [{ amount: 12, duration: 15, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Cejas Depilación con Cera',
            description: 'Limpieza de cejas con cera de alta calidad.',
          },
          {
            language: 'en',
            name: 'Eyebrow Waxing',
            description: 'Eyebrow cleaning with high-quality wax.',
          },
        ],
        prices: [{ amount: 10, duration: 15, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Cejas Depilación y Mapping',
            description:
              'Estudio morfológico y depilación para un diseño perfecto.',
          },
          {
            language: 'en',
            name: 'Eyebrow Mapping & Waxing',
            description:
              'Morphological study and hair removal for a perfect design.',
          },
        ],
        prices: [{ amount: 14, duration: 20, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Cejas Diseño Henna con Hilo',
            description: 'Diseño con hilo y sombreado con henna natural.',
          },
          {
            language: 'en',
            name: 'Henna Design & Threading',
            description: 'Threading design and natural henna shading.',
          },
        ],
        prices: [{ amount: 25, duration: 30, currency: 'EUR' }],
        sedeIds: [4],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Cejas Diseño Henna con Cera',
            description: 'Diseño con cera y sombreado con henna natural.',
          },
          {
            language: 'en',
            name: 'Henna Design & Waxing',
            description: 'Waxing design and natural henna shading.',
          },
        ],
        prices: [{ amount: 22, duration: 30, currency: 'EUR' }],
        sedeIds: [4],
      },

      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Pack medio cuerpo',
            description:
              'Sesión de depilación láser para medio cuerpo: Superior o inferior.',
          },
          {
            language: 'en',
            name: 'Half Body Pack',
            description:
              'Laser hair removal session for half body: Upper or lower part.',
          },
        ],
        prices: [{ amount: 62, duration: 40, currency: 'EUR' }],
        sedeIds: [4],
      },
    ];

    const categoryIds = [
      ...new Set(
        services
          .map((service) => service.categoryId)
          .filter((id): id is number => id !== undefined),
      ),
    ];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    if (categories.length !== categoryIds.length) {
      throw new ForbiddenException(
        'No existen todas las categorías requeridas. Ejecuta primero el seed de categorías.',
      );
    }

    const sedeIds = [
      ...new Set(services.flatMap((service) => service.sedeIds ?? [])),
    ];
    if (sedeIds.length) {
      const sedes = await this.prisma.sede.findMany({
        where: { id: { in: sedeIds } },
      });

      if (sedes.length !== sedeIds.length) {
        throw new ForbiddenException(
          'Una o más sedes no existen. Ejecuta primero el seed de sedes.',
        );
      }
    }

    await this.prisma.serviceSedeProfesional.deleteMany();
    await this.prisma.price.deleteMany();
    await this.prisma.serviceTranslation.deleteMany();
    await this.prisma.service.deleteMany();

    for (const service of services) {
      await this.prisma.service.create({
        data: {
          category: { connect: { id: service.categoryId } },
          sedes: service.sedeIds?.length
            ? { connect: service.sedeIds.map((id) => ({ id })) }
            : undefined,
          translations: {
            create: service.translations?.map((translation) => ({
              language: translation.language,
              name: translation.name,
              description: translation.description,
            })),
          },
          prices: {
            create: service.prices?.map((price) => ({
              amount: price.amount,
              duration: price.duration,
              currency: price.currency ?? 'EUR',
            })),
          },
        } satisfies Prisma.ServiceCreateInput,
      });
    }

    return {
      message: '✅ Seed de servicios ejecutado correctamente.',
      total: services.length,
    };
  }

  async seedSedes() {
    // ✅ Crear sedes con los campos correctos según tu modelo Prisma y DTO
    await this.prisma.sede.createMany({
      data: [
        {
          nombre: 'Glow Benalmádena',
          direccion:
            'Calle Medina Azahara, 1, 29631 Benalmádena, Málaga, España',
          telefono: '+34651026700',
          latitud: 36.60546878004542,
          longitud: -4.532211836176817,
          provincia: 'Benalmádena',
          horario: {
            lunes: '10:00-19:00',
            martes: '10:00-19:00',
            miércoles: '10:00-19:00',
            jueves: '10:00-19:00',
            viernes: '10:00-19:00',
            sábado: '10:00-19:00',
            domingo: 'Cerrado',
          },
          diasCerrado: [
            // no publicados oficialmente
          ],
          empresaId: 1, // 👈 ajusta según el ID real de WB Corporation / Glow Experience
          imagenes: [
            'uploads/bookmy/sedes/1/77ad7959fdd35715d9e189f2f5d70527.jpeg',
            'uploads/bookmy/sedes/1/7c681ea63d4a050acd18c5a65aa74502.jpeg',
            'uploads/bookmy/sedes/1/c0c12fa4517b65e0a3c1bb3d04fc0074.jpeg',
          ],
        },
        {
          nombre: 'Glow Fuengirola',
          direccion: 'C. Marbella, 6, 29640 Fuengirola, Málaga, España',
          telefono: '+34651026701',
          latitud: 36.5406,
          longitud: -4.6247,
          provincia: 'Fuengirola',
          horario: {
            lunes: '10:00-19:00',
            martes: '10:00-19:00',
            miércoles: '10:00-19:00',
            jueves: '10:00-19:00',
            viernes: '10:00-19:00',
            sábado: '10:00-19:00',
            domingo: 'Cerrado',
          },
          diasCerrado: [
            // no publicados oficialmente
          ],
          empresaId: 1,
          imagenes: [
            'uploads/bookmy/sedes/2/b4efa3edf6faf76e2d37d00813aee87e.jpeg',
            'uploads/bookmy/sedes/2/bf33cdcefb791969eba7025f05377290.jpeg',
            'uploads/bookmy/sedes/2/ceaaf695174bc876d63944c79a165453.jpeg',
            'uploads/bookmy/sedes/2/b5a3c3ea7f6aa5f543a7985876343280.jpeg',
          ],
        },
        {
          nombre: 'Glow Marbella',
          direccion: 'C. Pablo Casals, 3, 29602 Marbella, Málaga, España',
          telefono: '+34699732239',
          latitud: 36.50916245978868,
          longitud: -4.893536260774952,
          provincia: 'Málaga',
          horario: {
            lunes: '10:00-19:00',
            martes: '10:00-19:00',
            miércoles: '10:00-19:00',
            jueves: '10:00-19:00',
            viernes: '10:00-19:00',
            sábado: '10:00-19:00',
            domingo: 'Cerrado',
          },
          diasCerrado: [
            // no publicados oficialmente
          ],
          empresaId: 1, // 👈 ajusta según el ID real de WB Corporation / Glow Experience
          imagenes: [
            'uploads/bookmy/sedes/3/56bb8899ec3ff621cfa8449b40e5a244.jpeg',
            'uploads/bookmy/sedes/3/00fca0273245d665199b1aa642a7fa5a.jpeg',
            'uploads/bookmy/sedes/3/482c002faea4017cb3e07e6741c44501.jpeg',
            'uploads/bookmy/sedes/3/0f597b287095f8293d705798a340bd49.jpeg',
          ], // las imagenes que subiran al drive o carpeta compartida
        },
        {
          nombre: ' Lash By Glow',
          direccion: 'Calle Los Cármenes, 5, 29631,',
          telefono: '+34685544742',
          latitud: 36.60211848837215,
          longitud: -4.531658007730843,
          provincia: 'Málaga',
          horario: {
            lunes: '10:00-19:00',
            martes: '10:00-19:00',
            miércoles: '10:00-19:00',
            jueves: '10:00-19:00',
            viernes: '10:00-19:00',
            sábado: '10:00-19:00',
            domingo: 'Cerrado',
          },
          diasCerrado: [
            // no publicados oficialmente
          ],
          empresaId: 1, // 👈 ajusta según el ID real de WB Corporation / Glow Experience
          imagenes: [
            'uploads/bookmy/sedes/4/4473fb93c33c0889f946f5d9d513fa19.jpeg',
            'uploads/bookmy/sedes/4/b3833e4734665e8cc515b99c644d783b.jpeg',
            'uploads/bookmy/sedes/4/56877cf54d552beb438ef82ded32e29f.jpeg',
            'uploads/bookmy/sedes/4/ca36adfd5a538af5e3db7dead49254e7.jpeg',
            'uploads/bookmy/sedes/4/c277db080a2129a17ed7e27ddaf041ec.jpeg',
          ], // las imagenes que subiran al drive o carpeta compartida
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
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/1b810cabfdba4ffba9202890e6712a-glow-fuengirola-laura-e36c370bb176421893583738986b8c-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Natalia',
          biografia:
            'Especialista en manicura y pedicura, dedicada al cuidado integral de las uñas.',
          phone: '+34666555449',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/629f3f297b154693a8ff2992ec350e-glow-fuengirola-natalia-c444ed18a3f341bca6afbbdee6f77c-booksy.jpeg?size=250x250&size=100x100',
        },
        {
          nombre: 'Gabriela',
          biografia:
            'Manicurista profesional con enfoque en tratamientos naturales y personalizados.',
          phone: '+34666555450',
          sedeId: 1,
          imagen:
            'https://d375139ucebi94.cloudfront.net/region2/es/25686/resource_photos/97eaa5d70ade4ccb94dbabde8cc2df-glow-fuengirola-gabriela-5c23aac4295b429ea292f86acc23d6-booksy.jpeg?size=250x250&size=100x100',
        },
      ],

      skipDuplicates: true,
    });

    return { message: '✅ Seed de profesionales ejecutado correctamente.' };
  }

  async seedServiceSedeProfesional() {
    await this.prisma.serviceSedeProfesional.deleteMany();

    const services = await this.prisma.service.findMany({
      include: {
        sedes: {
          select: { id: true },
        },
      },
      orderBy: { id: 'asc' },
    });
    if (services.length === 0) {
      throw new ForbiddenException(
        'No hay servicios registrados. Ejecuta primero el seed de servicios.',
      );
    }

    const profesionales = await this.prisma.profesional.findMany({
      orderBy: { id: 'asc' },
    });
    if (profesionales.length === 0) {
      throw new ForbiddenException(
        'No hay profesionales registrados. Ejecuta primero el seed de profesionales.',
      );
    }

    const relations: Prisma.ServiceSedeProfesionalCreateManyInput[] = [];

    for (const profesional of profesionales) {
      if (!profesional.sedeId) {
        continue;
      }

      const serviceForSede = services.find((service) =>
        service.sedes.some((sede) => sede.id === profesional.sedeId),
      );

      if (!serviceForSede) {
        console.warn(
          `No se encontró un servicio asociado a la sede ${profesional.sedeId} para el profesional ${profesional.id}.`,
        );
        continue;
      }

      relations.push({
        serviceId: serviceForSede.id,
        sedeId: profesional.sedeId,
        profesionalId: profesional.id,
      });
    }

    if (!relations.length) {
      throw new ForbiddenException(
        'No se generaron relaciones. Verifica que los servicios estén asociados a sedes.',
      );
    }

    await this.prisma.serviceSedeProfesional.createMany({
      data: relations,
      skipDuplicates: true,
    });

    return {
      message: '✅ Seed de Service-Sede-Profesional ejecutado correctamente.',
      total: relations.length,
    };
  }
}
