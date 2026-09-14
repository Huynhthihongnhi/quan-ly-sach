import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { NEW_PASSWORD_MIN_LENGTH } from '../../identity/password-policy';

export class CompleteChallengeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(NEW_PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  newPassword!: string;
}
