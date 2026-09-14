import { Global, Module } from '@nestjs/common';
import { CLOCK } from './clock.interface';
import { SystemClock } from './system-clock.service';

@Global()
@Module({
  providers: [
    SystemClock,
    {
      provide: CLOCK,
      useExisting: SystemClock,
    },
  ],
  exports: [SystemClock, CLOCK],
})
export class ClockModule {}
