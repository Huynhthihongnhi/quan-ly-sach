import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReplaceUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  roleIds!: string[];

  @IsString()
  version!: string;
}
