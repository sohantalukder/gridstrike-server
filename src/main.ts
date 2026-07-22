import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('GridStrike API')
    .setDescription('REST API for GridStrike mobile game')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const cfg = app.get(ConfigService);
  const env = cfg.get<string>('NODE_ENV') ?? 'development';
  if (env === 'development') {
    SwaggerModule.setup('docs', app, document);
  }

  app.enableCors();
  const port = cfg.get<number>('PORT') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`GridStrike server running: http://localhost:${port}`);
}

bootstrap();
