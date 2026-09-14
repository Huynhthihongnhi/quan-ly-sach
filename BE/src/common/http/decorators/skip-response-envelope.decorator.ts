import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_ENVELOPE = 'skipResponseEnvelope';

export const SkipResponseEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE, true);
