import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AssistantToolDefinition } from '../assistant-tools';
import { AssistantMessageDto } from '../dto/assistant-chat.dto';
import {
  LlmChatResult,
  LlmProvider,
  LlmToolCall,
} from './llm-provider.interface';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY no está configurada en el servidor.',
      );
    }
    return key;
  }

  private get model(): string {
    return this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  async chat(
    messages: AssistantMessageDto[],
    tools: AssistantToolDefinition[],
    toolsEnabled: boolean,
  ): Promise<LlmChatResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content ?? null,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
    };

    if (toolsEnabled && tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(OPENAI_CHAT_URL, body, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const choice = response.data?.choices?.[0];
      const message = choice?.message ?? {};

      const toolCalls: LlmToolCall[] | undefined = Array.isArray(
        message.tool_calls,
      )
        ? message.tool_calls.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function?.name,
              arguments: tc.function?.arguments ?? '{}',
            },
          }))
        : undefined;

      return {
        content: message.content ?? null,
        toolCalls,
        finishReason: choice?.finish_reason ?? 'stop',
        model: response.data?.model ?? this.model,
      };
    } catch (error: any) {
      this.logger.error(
        `Error llamando a OpenAI: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );
      throw new InternalServerErrorException(
        'No se pudo obtener respuesta del asistente (OpenAI).',
      );
    }
  }
}
