import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'mysql' as const,
        host: config.database.host,
        port: config.database.port,
        username: config.database.username,
        password: config.database.password,
        database: config.database.name,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        logging: config.nodeEnv !== 'production',
        retryAttempts: 10,
        retryDelay: 3000,
        supportBigNumbers: true,
        bigNumberStrings: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
