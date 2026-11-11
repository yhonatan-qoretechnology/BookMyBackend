import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthUser } from 'src/auth/common/decorators/auth-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/auth/types/authenticated-user.interface';
import {
  CHAT_MAX_FILE_SIZE_BYTES,
  CHAT_UPLOAD_TEMP_DIR,
} from './chat-file.constants';
import { chatAudioFileFilter, chatFileFilter } from './chat-file.filter';
import { ChatMessageService } from './chatMessage.service';
import { ChatGateway } from './chat.gateway';
import { CreateChatContactDto } from './dto/create-chat-contact.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SearchUserDto } from './dto/search-chat-user.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('ChatMessage')
@Controller('ChatMessage')
export class ChatMessageController {
  constructor(
    private readonly chatMessageService: ChatMessageService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Search users for chat contacts.
   */
  @Get('users')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Find a user by their exact email to start a chat',
  })
  async findUserByEmail(@Query() query: SearchUserDto) {
    return this.chatMessageService.findUserByEmail(query);
  }

  @Post('contacts')
  @ApiOperation({
    summary: 'Save chat contact',
  })
  async createContact(
    @Body() dto: CreateChatContactDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.chatMessageService.createContact(dto, user);
  }

  /**
   * Resolve the chat contact (branch or company admin) for a sede.
   *
   * Open to any authenticated user (CLIENT included) — unlike
   * `/admin/*`, which is role-gated to admins — so a client can start an
   * in-app conversation about a reservation without a manual "search
   * contacts" step.
   */
  @Get('sede-contact/:sedeId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get the chat contact (admin) for a sede',
  })
  async getSedeContact(@Param('sedeId', ParseIntPipe) sedeId: number) {
    return this.chatMessageService.getSedeChatContact(sedeId);
  }

  /**
   * Get chat contacts.
   */
  @Get('contacts/:userId')
  @ApiOperation({
    summary: 'Get chat contacts',
  })
  async getContacts(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.chatMessageService.getContacts(userId, user);
  }

  //enviar mensajes de chat

  /**
   * Get conversation messages.
   */
  @Get('messages/:userA/:userB')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Get conversation messages (only participants, sede/company admin of a participant, or super admin)',
  })
  async getConversation(
    @Param('userA', ParseIntPipe) userA: number,
    @Param('userB', ParseIntPipe) userB: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    return this.chatMessageService.getConversation(userA, userB, user);
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Save chat message',
  })
  async createMessage(
    @Body() dto: SendMessageDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    const saved = await this.chatMessageService.createMessage(dto, user);
    this.chatGateway.notificarMensaje(saved);
    return saved;
  }

  @Post('messages/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Mark a chat message as read',
  })
  async markMessageAsRead(
    @Body() dto: MarkMessageReadDto,
    @AuthUser() user: AuthenticatedUser,
  ) {
    const leido = await this.chatMessageService.markMessageAsRead(dto, user);
    this.chatGateway.notificarLeido(leido, user.userId);
    return leido;
  }

  /* El panel marca leída la conversación entera al abrirla. Antes mandaba
     { userId, contactId } a messages/read, que exige el id de cada
     mensaje, así que nunca se marcaba nada. */
  @Post('conversations/:contactId/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Marcar como leídos los mensajes recibidos de un contacto',
  })
  async markConversationAsRead(
    @Param('contactId', ParseIntPipe) contactId: number,
    @AuthUser() user: AuthenticatedUser,
  ) {
    const r = await this.chatMessageService.markConversationAsRead(contactId, user);
    for (const id of r.ids) {
      this.chatGateway.notificarLeido(
        { id, sender_id: contactId, read_at: r.readAt ?? null },
        user.userId,
      );
    }
    return { count: r.count };
  }

  /**
   * Upload a chat attachment (image or PDF).
   *
   * Returns the public fileUrl to send afterwards through the
   * `send_message` WebSocket event (messageType: IMAGE | FILE).
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upload a chat attachment (image or PDF)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Attachment file to upload (image or PDF)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      dest: CHAT_UPLOAD_TEMP_DIR,
      limits: { fileSize: CHAT_MAX_FILE_SIZE_BYTES },
      fileFilter: chatFileFilter,
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo (imagen o PDF).');
    }

    return this.chatMessageService.storeChatFile(file);
  }

  /**
   * Upload a chat voice message (audio).
   *
   * Separate endpoint from `/upload` so the front-end's file-attachment
   * flow and its voice-recorder flow stay independent. Returns the public
   * fileUrl to send afterwards through the `send_message` WebSocket event
   * (messageType: AUDIO).
   */
  @Post('upload-audio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upload a chat voice message (audio)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Audio file to upload (voice message)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      dest: CHAT_UPLOAD_TEMP_DIR,
      limits: { fileSize: CHAT_MAX_FILE_SIZE_BYTES },
      fileFilter: chatAudioFileFilter,
    }),
  )
  async uploadAudio(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de audio.');
    }

    return this.chatMessageService.storeChatAudio(file);
  }
}
