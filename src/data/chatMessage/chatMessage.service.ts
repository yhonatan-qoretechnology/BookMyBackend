import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChatContactDto } from './dto/create-chat-contact.dto';
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

  /**
   * Create a chat contact.
   *
   * This method creates the relationship in both directions:
   * - owner -> contact
   * - contact -> owner
   *
   * Using upsert prevents duplicate records if one of the
   * relationships already exists.
   *
   * @param dto Contact information.
   * @returns Created contact relationship.
   */
  async createContact(dto: CreateChatContactDto) {
    const { ownerUserId, contactUserId } = dto;

    if (ownerUserId === contactUserId) {
      throw new BadRequestException('You cannot add yourself as a contact.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Owner -> Contact
      await tx.chat_contact.upsert({
        where: {
          owner_user_id_contact_user_id: {
            owner_user_id: ownerUserId,
            contact_user_id: contactUserId,
          },
        },
        update: {},
        create: {
          owner_user_id: ownerUserId,
          contact_user_id: contactUserId,
        },
      });

      // Contact -> Owner
      await tx.chat_contact.upsert({
        where: {
          owner_user_id_contact_user_id: {
            owner_user_id: contactUserId,
            contact_user_id: ownerUserId,
          },
        },
        update: {},
        create: {
          owner_user_id: contactUserId,
          contact_user_id: ownerUserId,
        },
      });
    });

    return {
      success: true,
      message: 'Contact added successfully.',
    };
  }

  /**
   * Get all contacts for a user.
   *
   * @param userId User identifier.
   * @returns Contact list.
   */
  async getContacts(userId: number) {
    return this.prisma.chat_contact.findMany({
      where: {
        owner_user_id: userId,
      },

      orderBy: {
        created_at: 'desc',
      },

      include: {
        users_chat_contact_contact_user_idTousers: {
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
        },
      },
    });
  }
}
