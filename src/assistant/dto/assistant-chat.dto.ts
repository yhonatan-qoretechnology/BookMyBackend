import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AssistantToolCallFunctionDto {
  @ApiProperty({ example: 'buscar_todo' })
  @IsString()
  name: string;

  @ApiProperty({
    example: '{"q":"manicura"}',
    description: 'Argumentos de la tool, como string JSON (igual que OpenAI).',
  })
  @IsString()
  arguments: string;
}

export class AssistantToolCallDto {
  @ApiProperty({ example: 'call_HhIgtjrGbPxwz4vQqnO1BXk0' })
  @IsString()
  id: string;

  @ApiProperty({ enum: ['function'], example: 'function' })
  @IsIn(['function'])
  type: 'function';

  @ApiProperty({ type: AssistantToolCallFunctionDto })
  @ValidateNested()
  @Type(() => AssistantToolCallFunctionDto)
  function: AssistantToolCallFunctionDto;
}

export class AssistantMessageDto {
  @ApiProperty({
    enum: ['system', 'user', 'assistant', 'tool'],
    example: 'user',
  })
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role: 'system' | 'user' | 'assistant' | 'tool';

  @ApiPropertyOptional({
    example: '¿Qué servicios tiene la sede de Marbella?',
    description:
      'Puede venir vacío/null en un mensaje role="assistant" que solo trae tool_calls (sin texto).',
  })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiPropertyOptional({
    type: [AssistantToolCallDto],
    description:
      'Solo para reenviar el historial de un mensaje role="assistant" que pidió tool_calls en un turno anterior (necesario para que el modelo pueda relacionar los mensajes role="tool" que le siguen).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantToolCallDto)
  tool_calls?: AssistantToolCallDto[];

  @ApiPropertyOptional({
    description:
      'Solo para mensajes role="tool": id de la tool_call que este mensaje responde.',
  })
  @IsOptional()
  @IsString()
  tool_call_id?: string;

  @ApiPropertyOptional({
    description: 'Solo para mensajes role="tool": nombre de la tool ejecutada.',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class AssistantChatDto {
  @ApiProperty({ type: [AssistantMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantMessageDto)
  messages: AssistantMessageDto[];

  @ApiPropertyOptional({
    default: true,
    description:
      'Si es false, la conversación se envía al modelo sin catálogo de tools (respuesta solo de texto).',
  })
  @IsOptional()
  @IsBoolean()
  tools_enabled?: boolean;
}
