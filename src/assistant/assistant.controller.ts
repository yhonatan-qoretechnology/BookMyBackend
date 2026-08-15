import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AssistantService } from './assistant.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantThrottlerGuard } from './guards/assistant-throttler.guard';

@ApiTags('Assistant')
@Controller('api/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AssistantThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({
    summary: 'Chat con el asistente virtual (function calling)',
    description:
      'Recibe el historial de mensajes de la conversación y devuelve la respuesta del modelo en formato compatible con OpenAI (choices[0].message), incluyendo tool_calls cuando el modelo decide usar una tool. El header "Authorization: Bearer <token>" es opcional: si se envía, se usa para limitar por usuario (en vez de por IP) y para logging; el endpoint funciona igual sin él.',
  })
  @ApiBody({
    type: AssistantChatDto,
    examples: {
      pregunta_simple: {
        summary: '1. Pregunta simple (empezar por acá)',
        description:
          'Un mensaje "user" solo necesita role + content. Nunca le agregues tool_calls, tool_call_id ni name.',
        value: {
          messages: [
            { role: 'user', content: '¿Qué servicios tiene la sede de Marbella?' },
          ],
          tools_enabled: true,
        },
      },
      resultado_de_tool: {
        summary: '2. Respondiendo con el resultado de una tool',
        description:
          'Se usa después de que el paso 1 devolvió tool_calls: se reenvía el mensaje "assistant" con esos tool_calls tal cual, seguido del resultado real en un mensaje "tool".',
        value: {
          messages: [
            { role: 'user', content: '¿Qué servicios tiene la sede de Marbella?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'buscar_todo',
                    arguments: '{"q":"Marbella"}',
                  },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call_1',
              name: 'buscar_todo',
              content:
                '{"sedes":[{"id":3,"nombre":"Glow Marbella","direccion":"C. Pablo Casals, 3, Málaga"}],"servicios":[]}',
            },
          ],
          tools_enabled: true,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Respuesta del asistente.' })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas solicitudes (rate limit).',
  })
  async chat(@Body() dto: AssistantChatDto, @Req() req: any) {
    const userContext = req.assistantUserId
      ? { userId: req.assistantUserId as number }
      : undefined;

    return this.assistantService.chat(dto, userContext);
  }

  @Post('chat/test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AssistantThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({
    summary: '[Solo pruebas] Chat con el loop de tools ya resuelto',
    description:
      'Mandá una sola pregunta y el backend ejecuta por vos las tools de lectura que hagan falta (contra los datos reales), encadenándolas hasta obtener una respuesta final en texto. Pensado únicamente para probar el asistente desde Swagger sin armar el loop a mano. La app real NO debe usar este endpoint: ahí es la app quien ejecuta las tools, como está documentado en /chat. "cancelar_cita" nunca se ejecuta acá; si el modelo la pide, se corta y avisa que requiere confirmación.',
  })
  @ApiBody({
    type: AssistantChatDto,
    examples: {
      pregunta: {
        summary: 'Pregunta simple',
        value: {
          messages: [
            { role: 'user', content: '¿Qué servicios tiene la sede de Marbella?' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta final ya resuelta, con la traza de tools usadas.',
  })
  async chatTest(@Body() dto: AssistantChatDto, @Req() req: any) {
    const userContext = req.assistantUserId
      ? { userId: req.assistantUserId as number }
      : undefined;

    return this.assistantService.testChat(dto, userContext);
  }
}
