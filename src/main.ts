import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Iniciando bootstrap...');

  let app;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule);
    console.log('✅ 1. App creada');
  } catch (e) {
    console.error('❌ Error en NestFactory.create:', e.message);
    return;
  }

  const configService = app.get(ConfigService);
  const portRaw = configService.get('PORT') as string;
  const port = Number(portRaw) || 3000;
  console.log(`🎯 Puerto: ${port}`);

  // Static files
  try {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
    });
    console.log('✅ 2. Static assets configurados');
  } catch (e) {
    console.error('❌ Error en static assets:', e.message);
  }

  // Cookie parser
  try {
    app.use(cookieParser());
    console.log('✅ 3. Cookie parser configurado');
  } catch (e) {
    console.error('❌ Error en cookieParser:', e.message);
  }

  // CORS
  try {
    app.enableCors({ origin: true, credentials: true });
    console.log('✅ 4. CORS configurado');
  } catch (e) {
    console.error('❌ Error en CORS:', e.message);
  }

  // ValidationPipe
  try {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    console.log('✅ 5. ValidationPipe configurado');
  } catch (e) {
    console.error('❌ Error en ValidationPipe:', e.message);
  }

  // Swagger
  try {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BookMy Api')
      .setDescription('Documentación del API con autenticación.')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: { persistAuthorization: true, withCredentials: true },
    });
    console.log('✅ 6. Swagger configurado');
  } catch (e) {
    console.error('❌ Error en Swagger:', e.message);
  }

  // Escuchar
  try {
    console.log(`🔊 Ejecutando app.listen(${port})...`);
    await app.listen(port);
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
    console.log(`📚 Swagger: http://localhost:${port}/api`);
  } catch (e) {
    console.error('❌ Error en app.listen:', e.message);
  }
}
bootstrap();
