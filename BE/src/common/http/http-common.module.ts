import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { PermissionsGuard } from './guards/permissions.guard';
import { RoutePolicyGuard } from './guards/route-policy.guard';
import { SessionGuard } from './guards/session.guard';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: RoutePolicyGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class HttpCommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
