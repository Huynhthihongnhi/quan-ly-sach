import { IsDateString, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class IssueLibraryCardDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[\x21-\x7E]+$/)
  cardNumber!: string;

  @IsDateString()
  expiresAt!: string;
}
