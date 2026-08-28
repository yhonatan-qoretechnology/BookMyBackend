import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

import { AccessControlService } from 'src/auth/services/access-control/access-control.service';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { SftpStorageService } from 'src/storage/sftp-storage.service';
import { CHAT_AUDIO_UPLOAD_DIR, CHAT_UPLOAD_DIR } from './chat-file.constants';
import { compressChatImageInPlace } from './chat-image-compressor';
import { CreateChatContactDto } from './dto/create-chat-contact.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SearchUserDto } from './dto/search-chat-user.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageType } from './enums/message-type.enum';

@Injectable()
export class ChatMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sftpStorage: SftpStorageService,
    private readonly accessControlService: AccessControlService,
  ) {}

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
        UserData: {
          select: {
            name: true,
            phone: true,
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
   * Resolve who a CLIENT should chat with about a given sede: the admin
   * assigned to that specific sede (BRANCH_ADMIN) if there is one, or
   * otherwise any admin of the sede's company (COMPANY_ADMIN) as fallback.
   *
   * This exists because a client has no other way to discover a valid
   * chat `userId` for "message my branch": `findUserByEmail` needs an
   * exact email, and the admin-listing endpoints in
   * AdminManagementController are role-gated to admins only.
   *
   * @param sedeId Sede (branch) identifier.
   * @returns Minimal contact info to start/open a conversation.
   */
  async getSedeChatContact(sedeId: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true, empresaId: true },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada.');
    }

    const selectContact = {
      userId: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      // `SendMessageDto.receiverEmail` es obligatorio y no hay otra forma
      // de que el cliente lo consiga (no puede llamar a /admin/*).
      user: { select: { email: true } },
    } as const;

    const branchAdmin = await this.prisma.adminProfile.findFirst({
      where: { sedeId: sede.id },
      select: selectContact,
    });

    const adminProfile =
      branchAdmin ??
      (await this.prisma.adminProfile.findFirst({
        where: { empresaId: sede.empresaId, sedeId: null },
        select: selectContact,
      }));

    if (!adminProfile) {
      throw new NotFoundException(
        'Esta sede no tiene un contacto de chat configurado todavía.',
      );
    }

    return {
      userId: adminProfile.userId,
      email: adminProfile.user.email,
      name: `${adminProfile.firstName} ${adminProfile.lastName}`.trim(),
      photoUrl: adminProfile.photoUrl,
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

  //funcion de envio de mensajes de chat

  async getConversation(
    userA: number,
    userB: number,
    user: AuthenticatedUser,
  ) {
    await this.accessControlService.ensureChatAccessForUser(
      userA,
      userB,
      user,
    );

    return this.prisma.chat.findMany({
      where: {
        OR: [
          {
            sender_id: userA,
            receiver_id: userB,
          },
          {
            sender_id: userB,
            receiver_id: userA,
          },
        ],
      },
      orderBy: {
        created_at: 'asc',
      },
    });
  }

  /**
   * Save a chat message in the database.
   */
  async createMessage(dto: SendMessageDto, user: AuthenticatedUser) {
    await this.accessControlService.ensureChatAccessForUser(
      dto.senderId,
      dto.receiverId,
      user,
    );

    return this.prisma.chat.create({
      data: {
        sender_id: dto.senderId,
        receiver_id: dto.receiverId,
        sender_email: dto.senderEmail,
        receiver_email: dto.receiverEmail,
        message_type: dto.messageType,
        message: dto.message ?? null,
        file_url: dto.fileUrl ?? null,
      },
    });
  }

  async markMessageAsRead(dto: MarkMessageReadDto, user: AuthenticatedUser) {
    if (user.role !== Role.SUPER_ADMIN && user.userId !== dto.userId) {
      throw new ForbiddenException(
        'No puede marcar como leído un mensaje de otro usuario.',
      );
    }

    const message = await this.prisma.chat.findUnique({
      where: {
        id: dto.chatId,
      },
    });

    if (!message) {
      throw new BadRequestException('Chat message not found.');
    }

    if (message.receiver_id !== dto.userId) {
      throw new BadRequestException(
        'Only the receiver can mark the message as read.',
      );
    }

    return this.prisma.chat.update({
      where: {
        id: dto.chatId,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });
  }

  /**
   * Move a chat attachment to its final storage location (SFTP or local
   * `uploads/<uploadDir>`) and return its public URL, applying image
   * compression when applicable. Shared by storeChatFile and
   * storeChatAudio, each passing its own subfolder so images/PDF and
   * audio never mix on disk.
   */
  private async persistChatAttachment(
    file: Express.Multer.File,
    uploadDir: string,
  ) {
    const ext = path.extname(file.originalname) || '';
    const finalFileName = `${file.filename}${ext}`;
    const relativePath = path
      .join('uploads', uploadDir, finalFileName)
      .replace(/\\/g, '/');

    const tempAbsPath = path.isAbsolute(file.path)
      ? file.path
      : path.join(process.cwd(), file.path);

    const compressedSize = await compressChatImageInPlace(
      tempAbsPath,
      file.mimetype,
    );
    const sizeBytes = compressedSize ?? file.size;

    if (this.sftpStorage.isEnabled()) {
      const { publicUrl } = await this.sftpStorage.uploadLocalFile({
        localPath: file.path,
        remoteRelativePath: relativePath,
        deleteLocalAfter: true,
      });

      return { fileUrl: publicUrl, sizeBytes };
    }

    const uploadDirAbs = path.join(process.cwd(), 'uploads', uploadDir);
    if (!fs.existsSync(uploadDirAbs)) {
      fs.mkdirSync(uploadDirAbs, { recursive: true });
    }

    const finalAbsPath = path.join(uploadDirAbs, finalFileName);

    if (tempAbsPath !== finalAbsPath) {
      fs.renameSync(tempAbsPath, finalAbsPath);
    }

    const baseUrl = (
      this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? ''
    )
      .trim()
      .replace(/\/+$/g, '');

    const fileUrl = baseUrl ? `${baseUrl}/${relativePath}` : `/${relativePath}`;

    return { fileUrl, sizeBytes };
  }

  /**
   * Store a chat attachment (image or PDF) and return its public URL.
   */
  async storeChatFile(file: Express.Multer.File) {
    const messageType =
      file.mimetype === 'application/pdf' ? MessageType.FILE : MessageType.IMAGE;

    const { fileUrl, sizeBytes } = await this.persistChatAttachment(
      file,
      CHAT_UPLOAD_DIR,
    );

    return {
      fileUrl,
      messageType,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes,
    };
  }

  /**
   * Store a chat voice message (audio) and return its public URL.
   */
  async storeChatAudio(file: Express.Multer.File) {
    const { fileUrl, sizeBytes } = await this.persistChatAttachment(
      file,
      CHAT_AUDIO_UPLOAD_DIR,
    );

    return {
      fileUrl,
      messageType: MessageType.AUDIO,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes,
    };
  }
}
