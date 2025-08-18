// src/data/user-location/user-location.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateUserLocationDto {
  latitude: number;
  longitude: number;
  address?: string;
}

@Injectable()
export class UserLocationService {
  constructor(private prisma: PrismaService) {}

  async save(userId: number, dto: CreateUserLocationDto) {
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
