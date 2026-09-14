import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_ROUTE } from '../constants/metadata-keys';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_ROUTE, true);
