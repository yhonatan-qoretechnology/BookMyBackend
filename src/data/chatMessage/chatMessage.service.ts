import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { SearchUserDto } from './dto/search-chat-user.dto';

@Injectable()
export class ChatMessageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search users for chat.
   *
   * @param query Search filters.
   * @returns Users list.
   */
  /**
   * Search a user by email.
   *
   * @param query Search user DTO.
   * @returns User information.
   */
  /**
   * Search a user by email.
   *
   * @param query Search user DTO.
   * @returns User information.
   */
  async findUserByEmail(query: SearchUserDto) {
    const { email } = query;

    return this.prisma.users.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        role: true,
        fotoPerfil: true,

        UserStatus: {
          select: {
            id: true,
            code: true,

            UserStatusTranslation: {
              where: {
                language: 'es',
              },
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }
}
