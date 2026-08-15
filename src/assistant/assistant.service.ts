import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantToolExecutorService } from './assistant-tool-executor.service';
import {
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_TOOLS,
} from './assistant-tools';
import { AssistantChatDto, AssistantMessageDto } from './dto/assistant-chat.dto';
import { AnthropicProvider } from './providers/anthropic.provider';
import { LlmChatResult, LlmProvider } from './providers/llm-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';

export interface AssistantTestChatResponse {
  respuesta: string | null;
  requiereConfirmacion?: boolean;
  mensaje?: string;
  pasos: Array<{ tool: string; resumen: string }>;
  vueltas: number;
}

export interface AssistantChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: [
    {
      index: 0;
      message: {
        role: 'assistant';
        content: string | null;
        tool_calls?: unknown;
      };
      finish_reason: string;
    },
  ];
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  private readonly MAX_TEST_ROUNDS = 4;

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly prisma: PrismaService,
    private readonly toolExecutor: AssistantToolExecutorService,
  ) {}

  private resolveProvider(): LlmProvider {
    const configured = (
      this.configService.get<string>('LLM_PROVIDER') ?? ''
    ).toLowerCase();

    if (configured === 'anthropic') return this.anthropicProvider;
    if (configured === 'openai') return this.openAiProvider;

    // Sin LLM_PROVIDER explícito: usamos el que tenga API key configurada.
    if (this.configService.get<string>('OPENAI_API_KEY')) {
      return this.openAiProvider;
    }
    if (this.configService.get<string>('ANTHROPIC_API_KEY')) {
      return this.anthropicProvider;
    }

    // Default: OpenAI (fallará con un mensaje claro si falta la key).
    return this.openAiProvider;
  }

  /**
   * Guarda en assistant_conversations el/los mensaje(s) nuevos que mandó el
   * cliente en este llamado y la respuesta del modelo. No es el historial
   * completo (el cliente ya lo reenvía completo en cada request) sino un
   * log incremental para auditar uso, costos y ajustar el prompt.
   */
  private async logConversation(
    incomingMessages: AssistantMessageDto[],
    result: LlmChatResult,
    userId?: number,
  ): Promise<void> {
    const rows: Array<{
      userId: number | null;
      role: string;
      content: string | null;
      toolName: string | null;
      toolCallId: string | null;
      toolArguments: string | null;
      provider: string | null;
      model: string | null;
    }> = [];

    // El cliente reenvía todo el historial en cada request; lo único
    // "nuevo" respecto de la vuelta anterior es el último mensaje.
    const lastIncoming = incomingMessages[incomingMessages.length - 1];
    if (lastIncoming) {
      rows.push({
        userId: userId ?? null,
        role: lastIncoming.role,
        content: lastIncoming.content ?? null,
        toolName: lastIncoming.name ?? null,
        toolCallId: lastIncoming.tool_call_id ?? null,
        toolArguments: null,
        provider: null,
        model: null,
      });
    }

    const providerName = result.model?.startsWith('claude')
      ? 'anthropic'
      : 'openai';

    if (result.content) {
      rows.push({
        userId: userId ?? null,
        role: 'assistant',
        content: result.content,
        toolName: null,
        toolCallId: null,
        toolArguments: null,
        provider: providerName,
        model: result.model,
      });
    }

    for (const toolCall of result.toolCalls ?? []) {
      rows.push({
        userId: userId ?? null,
        role: 'assistant',
        content: null,
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
        toolArguments: toolCall.function.arguments,
        provider: providerName,
        model: result.model,
      });
    }

    if (rows.length === 0) return;

    await this.prisma.assistantConversation.createMany({ data: rows });
  }

  async chat(
    dto: AssistantChatDto,
    userContext?: { userId?: number; email?: string },
  ): Promise<AssistantChatResponse> {
    const toolsEnabled = dto.tools_enabled ?? true;

    // El system prompt lo define y versiona el backend. Cualquier mensaje
    // "system" que mande el cliente se descarta para evitar prompts
    // duplicados o inconsistentes.
    const conversation = [
      { role: 'system' as const, content: ASSISTANT_SYSTEM_PROMPT },
      ...dto.messages.filter((m) => m.role !== 'system'),
    ];

    const provider = this.resolveProvider();

    this.logger.log(
      `[assistant.chat] provider=${provider.constructor.name} userId=${userContext?.userId ?? 'anon'} toolsEnabled=${toolsEnabled} msgCount=${conversation.length}`,
    );

    const result = await provider.chat(
      conversation,
      ASSISTANT_TOOLS,
      toolsEnabled,
    );

    // Logging best-effort: nunca debe romper la respuesta al cliente si
    // falla (ej. problema puntual de conexión a la BD).
    this.logConversation(dto.messages, result, userContext?.userId).catch(
      (error) =>
        this.logger.error(
          `No se pudo loggear la conversación del asistente: ${error?.message ?? error}`,
        ),
    );

    return {
      id: `assistant-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
            ...(result.toolCalls ? { tool_calls: result.toolCalls } : {}),
          },
          finish_reason: result.finishReason,
        },
      ],
    };
  }

  /**
   * SOLO PARA PROBAR. Resuelve todo el ida-y-vuelta de tools del lado del
   * servidor (algo que en la app real hace la app, no el backend) y
   * devuelve directamente la respuesta final en texto. Útil para probar
   * el asistente desde Swagger con una sola pregunta, sin tener que armar
   * a mano los mensajes assistant/tool intermedios.
   *
   * `cancelar_cita` nunca se ejecuta acá: si el modelo la pide, se corta
   * el loop y se devuelve requiereConfirmacion=true, igual que tendría que
   * pasar en la app real.
   */
  async testChat(
    dto: AssistantChatDto,
    userContext?: { userId?: number },
  ): Promise<AssistantTestChatResponse> {
    let messages: AssistantMessageDto[] = [...dto.messages];
    const pasos: Array<{ tool: string; resumen: string }> = [];

    for (let vuelta = 1; vuelta <= this.MAX_TEST_ROUNDS; vuelta++) {
      const response = await this.chat(
        { messages, tools_enabled: true },
        userContext,
      );
      const message = response.choices[0].message;
      const toolCalls = message.tool_calls as
        | Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>
        | undefined;

      if (!toolCalls || toolCalls.length === 0) {
        return { respuesta: message.content, pasos, vueltas: vuelta };
      }

      messages = [
        ...messages,
        { role: 'assistant', content: message.content, tool_calls: toolCalls },
      ];

      for (const toolCall of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          // argumentos inválidos: seguimos con args vacío
        }
        const execResult = await this.toolExecutor.execute(
          toolCall.function.name,
          args,
          userContext?.userId,
        );

        pasos.push({
          tool: toolCall.function.name,
          resumen: execResult.label ?? execResult.message ?? 'Consultado',
        });

        if (execResult.requiresConfirmation) {
          return {
            respuesta: null,
            requiereConfirmacion: true,
            mensaje: execResult.message,
            pasos,
            vueltas: vuelta,
          };
        }

        messages = [
          ...messages,
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(
              execResult.ok ? execResult.result : { error: execResult.message },
            ),
          },
        ];
      }
    }

    return {
      respuesta: null,
      mensaje: `Se alcanzó el máximo de ${this.MAX_TEST_ROUNDS} vueltas sin llegar a una respuesta final.`,
      pasos,
      vueltas: this.MAX_TEST_ROUNDS,
    };
  }
}
