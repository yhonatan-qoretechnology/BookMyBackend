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

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Adapta la API de Anthropic (Claude) al mismo formato normalizado que usa
 * OpenAiProvider, para que el resto del backend (y la respuesta final al
 * cliente, tipo `choices[0].message`) no tenga que saber qué proveedor
 * respondió.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY no está configurada en el servidor.',
      );
    }
    return key;
  }

  private get model(): string {
    return (
      this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5'
    );
  }

  async chat(
    messages: AssistantMessageDto[],
    tools: AssistantToolDefinition[],
    toolsEnabled: boolean,
  ): Promise<LlmChatResult> {
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.tool_call_id ?? '',
                content: m.content ?? '',
              },
            ],
          };
        }

        if (m.role === 'assistant' && m.tool_calls?.length) {
          const blocks: unknown[] = [];
          if (m.content) blocks.push({ type: 'text', text: m.content });
          for (const tc of m.tool_calls) {
            let input: unknown = {};
            try {
              input = JSON.parse(tc.function.arguments || '{}');
            } catch {
              input = {};
            }
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input,
            });
          }
          return { role: 'assistant' as const, content: blocks };
        }

        return {
          role:
            m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: [{ type: 'text', text: m.content ?? '' }],
        };
      });

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt || undefined,
      messages: anthropicMessages,
    };

    if (toolsEnabled && tools.length > 0) {
      body.tools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(ANTHROPIC_MESSAGES_URL, body, {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
      );

      const blocks: any[] = response.data?.content ?? [];

      const textContent = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const toolCalls: LlmToolCall[] | undefined = blocks
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input ?? {}),
          },
        }));

      const stopReason = response.data?.stop_reason;
      const finishReason =
        stopReason === 'tool_use'
          ? 'tool_calls'
          : stopReason === 'max_tokens'
            ? 'length'
            : 'stop';

      return {
        content: textContent.length > 0 ? textContent : null,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        model: response.data?.model ?? this.model,
      };
    } catch (error: any) {
      this.logger.error(
        `Error llamando a Anthropic: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );
      throw new InternalServerErrorException(
        'No se pudo obtener respuesta del asistente (Anthropic).',
      );
    }
  }
}
