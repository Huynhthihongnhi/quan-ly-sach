import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ApiException } from './common/http/api.exception';
import { ErrorCode } from './common/http/error-code';

export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const fields = errors.flatMap((error) => {
          const constraints = error.constraints ?? {};
          return Object.keys(constraints).map((code) => ({
            field: error.property,
            code: code.toUpperCase(),
          }));
        });

        return new ApiException(422, ErrorCode.VALIDATION_FAILED, 'Validation failed.', fields);
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Quan Ly Sach API')
    .setDescription('Library intranet backend contract')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
  });
}
