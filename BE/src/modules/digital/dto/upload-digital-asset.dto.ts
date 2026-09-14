import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadDigitalAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rightsNote!: string;
}
