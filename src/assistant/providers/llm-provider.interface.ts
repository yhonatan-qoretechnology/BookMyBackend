import { AssistantMessageDto } from '../dto/assistant-chat.dto';
import { AssistantToolDefinition } from '../assistant-tools';

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON string con los argumentos, como espera el formato OpenAI. */
    arguments: string;
  };
}

export interface LlmChatResult {
  content: string | null;
  toolCalls?: LlmToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  model: string;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';

export interface LlmProvider {
  /**
   * Envía la conversación (con el system prompt ya incluido en `messages`)
   * y, si `toolsEnabled` es true, el catálogo de tools, al modelo.
   * Devuelve el resultado ya normalizado a un formato único, independiente
   * del proveedor.
   */
  chat(
    messages: AssistantMessageDto[],
    tools: AssistantToolDefinition[],
    toolsEnabled: boolean,
  ): Promise<LlmChatResult>;
}
