import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './entities/profile.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile])],
  providers: [UserRepository],
  exports: [UserRepository, TypeOrmModule],
})
export class IdentityModule {}
