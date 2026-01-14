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
        logo: '/uploads/logos/glow-experience.png',
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
    } catch (err) {
      console.error(err);
    }
  }

  async seedCategories() {
    console.log('🌱 Iniciando seed de categorías...');

    const categories = [
      {
        image: 'https://cdn.miapp.com/categories/manicura.png',
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
        image: 'https://cdn.miapp.com/categories/pedicura.png',
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
        image: 'https://cdn.miapp.com/categories/refuerzos.png',
        translations: [
          {
            language: 'es',
            name: 'Refuerzos',
            description: 'Refuerzos de uñas y fortalecimiento',
          },
          {
            language: 'en',
            name: 'Nail Reinforcement',
            description: 'Nail reinforcement and strengthening',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/acrilicas.png',
        translations: [
          {
            language: 'es',
            name: 'Extensiones Acrílicas',
            description: 'Extensiones de uñas acrílicas',
          },
          {
            language: 'en',
            name: 'Acrylic Extensions',
            description: 'Acrylic nail extensions',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/polygel.png',
        translations: [
          {
            language: 'es',
            name: 'Extensiones Polygel',
            description: 'Extensiones de uñas en polygel',
          },
          {
            language: 'en',
            name: 'Polygel Extensions',
            description: 'Polygel nail extensions',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/extras-unas.png',
        translations: [
          {
            language: 'es',
            name: 'Extras para tus Uñas',
            description: 'Servicios adicionales y decoración de uñas',
          },
          {
            language: 'en',
            name: 'Nail Extras',
            description: 'Additional nail services and decorations',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/cejas.png',
        translations: [
          {
            language: 'es',
            name: 'Cejas',
            description: 'Diseño, depilación y tinte de cejas',
          },
          {
            language: 'en',
            name: 'Eyebrows',
            description: 'Eyebrow design, waxing and tinting',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/cera.png',
        translations: [
          {
            language: 'es',
            name: 'Depilación con Cera',
            description: 'Depilación corporal y facial con cera',
          },
          {
            language: 'en',
            name: 'Waxing',
            description: 'Body and facial waxing services',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/hilo.png',
        translations: [
          {
            language: 'es',
            name: 'Depilación con Hilo',
            description: 'Depilación facial con hilo',
          },
          {
            language: 'en',
            name: 'Threading',
            description: 'Facial threading services',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/pestanas.png',
        translations: [
          {
            language: 'es',
            name: 'Pestañas',
            description: 'Lifting y tratamientos de pestañas',
          },
          {
            language: 'en',
            name: 'Eyelashes',
            description: 'Eyelash lifting and treatments',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/laser.png',
        translations: [
          {
            language: 'es',
            name: 'Depilación Láser',
            description: 'Depilación láser por zonas',
          },
          {
            language: 'en',
            name: 'Laser Hair Removal',
            description: 'Laser hair removal by areas',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/limpieza-facial.png',
        translations: [
          {
            language: 'es',
            name: 'Limpiezas Faciales',
            description: 'Higiene y limpieza facial profesional',
          },
          {
            language: 'en',
            name: 'Facial Cleansing',
            description: 'Professional facial cleansing services',
          },
        ],
      },
      {
        image: 'https://cdn.miapp.com/categories/dermapen.png',
        translations: [
          {
            language: 'es',
            name: 'Dermapen',
            description: 'Tratamientos faciales con dermapen',
          },
          {
            language: 'en',
            name: 'Dermapen',
            description: 'Facial dermapen treatments',
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
        categoryId: 1,
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
        prices: [{ amount: 30, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 1,
        translations: [
          {
            language: 'es',
            name: 'Manicura Rusa Semipermanente',
            description: 'Manicura rusa con esmaltado semipermanente',
          },
          {
            language: 'en',
            name: 'Russian Semi-Permanent Manicure',
            description: 'Russian manicure with semi-permanent polish',
          },
        ],
        prices: [{ amount: 38, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Semipermanente',
            description: 'Pedicura completa con esmalte semipermanente',
          },
          {
            language: 'en',
            name: 'Semi-Permanent Pedicure',
            description: 'Complete pedicure with semi-permanent polish',
          },
        ],
        prices: [{ amount: 35, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 2,
        translations: [
          {
            language: 'es',
            name: 'Pedicura Jelly SPA',
            description: 'Pedicura SPA con tratamiento Jelly',
          },
          {
            language: 'en',
            name: 'Jelly SPA Pedicure',
            description: 'SPA pedicure with jelly treatment',
          },
        ],
        prices: [{ amount: 45, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 3,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo BIAB',
            description: 'Refuerzo de uña natural con BIAB',
          },
          {
            language: 'en',
            name: 'BIAB Nail Reinforcement',
            description: 'Natural nail reinforcement with BIAB',
          },
        ],
        prices: [{ amount: 40, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 3,
        translations: [
          {
            language: 'es',
            name: 'Refuerzo Fibra',
            description: 'Refuerzo de uñas con fibra de vidrio',
          },
          {
            language: 'en',
            name: 'Fiber Nail Reinforcement',
            description: 'Glass fiber nail reinforcement',
          },
        ],
        prices: [{ amount: 42, duration: 80, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Uñas Acrílicas',
            description: 'Extensión de uñas acrílicas',
          },
          {
            language: 'en',
            name: 'Acrylic Nails',
            description: 'Acrylic nail extensions',
          },
        ],
        prices: [{ amount: 50, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 4,
        translations: [
          {
            language: 'es',
            name: 'Relleno Acrílico',
            description: 'Mantenimiento de uñas acrílicas',
          },
          {
            language: 'en',
            name: 'Acrylic Refill',
            description: 'Maintenance of acrylic nails',
          },
        ],
        prices: [{ amount: 40, duration: 75, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 5,
        translations: [
          {
            language: 'es',
            name: 'Uñas Polygel',
            description: 'Extensión de uñas con polygel',
          },
          {
            language: 'en',
            name: 'Polygel Nails',
            description: 'Polygel nail extensions',
          },
        ],
        prices: [{ amount: 48, duration: 90, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 6,
        translations: [
          {
            language: 'es',
            name: 'Decoración de Uñas',
            description: 'Decoración artística y nail art',
          },
          {
            language: 'en',
            name: 'Nail Art Decoration',
            description: 'Artistic nail decoration',
          },
        ],
        prices: [{ amount: 10, duration: 15, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 7,
        translations: [
          {
            language: 'es',
            name: 'Lifting y Tinte de Pestañas',
            description: 'Curvado y tinte de pestañas',
          },
          {
            language: 'en',
            name: 'Lash Lift and Tint',
            description: 'Eyelash lifting and tinting',
          },
        ],
        prices: [{ amount: 45, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 8,
        translations: [
          {
            language: 'es',
            name: 'Diseño de Cejas con Henna',
            description: 'Diseño y coloración de cejas con henna',
          },
          {
            language: 'en',
            name: 'Henna Eyebrow Design',
            description: 'Eyebrow shaping and henna coloring',
          },
        ],
        prices: [{ amount: 30, duration: 45, currency: 'EUR' }],
        sedeIds: [1],
      },
      {
        categoryId: 9,
        translations: [
          {
            language: 'es',
            name: 'Limpieza Facial',
            description: 'Limpieza facial profunda profesional',
          },
          {
            language: 'en',
            name: 'Facial Cleansing',
            description: 'Professional deep facial cleansing',
          },
        ],
        prices: [{ amount: 50, duration: 60, currency: 'EUR' }],
        sedeIds: [1],
      },
    ];

    const categoryIds = [
      ...new Set(services.map((service) => service.categoryId)),
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
            create: service.translations.map((translation) => ({
              language: translation.language,
              name: translation.name,
              description: translation.description,
            })),
          },
          prices: {
            create: service.prices.map((price) => ({
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
          latitud: 36.5969,
          longitud: -4.5426,
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
            '/uploads/sedes/benalmadena/front.jpg',
            '/uploads/sedes/benalmadena/interior.jpg',
          ],
        },
        {
          nombre: 'Glow Fuengirola',
          direccion: 'C. Marbella, 6, 29640 Fuengirola, Málaga, España',
          telefono: '+34651026701',
          latitud: 36.5406,
          longitud: -4.6247,
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
          empresaId: 1,
          imagenes: [
            '/uploads/sedes/fuengirola/front.jpg',
            '/uploads/sedes/fuengirola/interior.jpg',
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
