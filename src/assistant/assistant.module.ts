import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { SearchModule } from '../data/search/search.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssistantToolExecutorService } from './assistant-tool-executor.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantThrottlerGuard } from './guards/assistant-throttler.guard';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PrismaModule,
    SearchModule,
    // Solo se usa para verificar (no firmar) el Bearer token opcional que
    // manda la app, con el mismo secreto que usa el resto del backend.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET_KEY'),
      }),
    }),
    // Límite propio de este endpoint (no afecta al resto de la API).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 8 }]),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    OpenAiProvider,
    AnthropicProvider,
    AssistantThrottlerGuard,
    AssistantToolExecutorService,
  ],
})
export class AssistantModule {}
