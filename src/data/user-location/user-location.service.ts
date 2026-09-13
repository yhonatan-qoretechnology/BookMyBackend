// src/data/user-location/user-location.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserLocationDto } from './dto/create-user-location.dto';

/* El DTO real vive en ./dto/create-user-location.dto.ts. Aqui habia una
   interfaz local con los mismos campos menos los geograficos: al hacer
   `...dto` los valores si llegaban a Prisma, pero el tipo mentia y cualquiera
   que se fiara de el habria dado por hecho que la ciudad no se guarda. */
type DatosUbicacion = Omit<CreateUserLocationDto, 'userId'>;

@Injectable()
export class UserLocationService {
  constructor(private prisma: PrismaService) {}

  async save(userId: number, dto: DatosUbicacion) {
    // opcional: validar que el usuario exista
    await this.ensureUser(userId);

    return this.prisma.userLocation.upsert({
      where: { userId }, // funciona porque userId es @unique
      update: { ...dto },
      create: { ...dto, userId },
    });
  }

  async get(userId: number) {
    const location = await this.prisma.userLocation.findUnique({
      where: { userId },
    });
    if (!location) throw new NotFoundException('Location not found for user');
    return location;
  }

  private async ensureUser(userId: number) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
  }
}
