import { SetMetadata } from '@nestjs/common';

export const IS_SESSION_ROUTE = 'isSessionRoute';

export const SessionRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_SESSION_ROUTE, true);
