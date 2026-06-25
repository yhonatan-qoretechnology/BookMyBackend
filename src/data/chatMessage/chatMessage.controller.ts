import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ChatMessageService } from './chatMessage.service';
import { SearchUserDto } from './dto/search-user.dto';

@ApiTags('ChatMessage')
@Controller('ChatMessage')
export class ChatMessageController {
  constructor(private readonly chatMessageService: ChatMessageService) {}

  /**
   * Search users for chat contacts.
   */
  @Get('users')
  @ApiOperation({
    summary: 'Search users available for chat',
  })
  async findUserByEmail(@Query() query: SearchUserDto) {
    return this.chatMessageService.findUserByEmail(query);
  }
}
