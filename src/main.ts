import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply global validation pipe with best practices
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove non-whitelisted properties from DTOs
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are sent
      transform: true, // Automatically transform incoming payload to DTO instances
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BookMy Api')
    .setDescription('Documentación del api con autenticación.')
    .setVersion('1.0')
    // 👇 Esto es CRUCIAL para que el botón "Authorize" aparezca en Swagger UI
    .addBearerAuth(
      {
        type: 'http', // Specifies the security scheme type as HTTP
        scheme: 'bearer', // Indicates that the authentication scheme is Bearer
        bearerFormat: 'JWT', // Specifies the format of the Bearer token (JWT)
        name: 'JWT', // The name displayed in Swagger UI for this security input
        description: 'Introduce tu token JWT aquí (sin el prefijo "Bearer ")', // Instructions for the user
        in: 'header', // The location of the API key (in the header)
      },
      'access-token', // 👈 Este es el "nombre" de tu esquema de seguridad.
      //    Debe coincidir con el que usas en @ApiBearerAuth('access-token')
      //    en tus controladores.
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // 'api' is the path where Swagger UI will be served (e.g., http://localhost:3000/api)

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
}
bootstrap();
