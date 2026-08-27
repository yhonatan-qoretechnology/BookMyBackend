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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  console.log('✅ 1. App creada');

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

  /* Sin ValidationPipe se pierden whitelist y forbidNonWhitelisted, es decir,
     la validación de TODOS los DTO. Si falla, es mejor no arrancar. */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  console.log('✅ 5. ValidationPipe configurado');

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

  console.log(`🔊 Ejecutando app.listen(${port})...`);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Servidor corriendo en el puerto ${port}`);
  console.log(`📚 Swagger: /api`);
}

/**
 * Un arranque fallido tiene que RUIDOSAMENTE terminar en error.
 *
 * Antes cada paso del bootstrap iba en su propio try/catch que registraba el
 * fallo y seguía adelante (o hacía `return`), así que el proceso terminaba con
 * código 0. Para la plataforma eso es una salida limpia: no reinicia, no avisa,
 * y su router responde un 404 en texto plano a todo — que además, al no llevar
 * cabeceras CORS, el navegador reporta como "NetworkError" en vez de decir que
 * el servidor no está.
 */
bootstrap().catch((error) => {
  console.error('❌ El backend no pudo arrancar:', error);
  process.exit(1);
});

/* Una promesa rechazada sin capturar tumbaba el proceso sin dejar rastro
   de qué la provocó. */
process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada sin capturar:', reason);
});
