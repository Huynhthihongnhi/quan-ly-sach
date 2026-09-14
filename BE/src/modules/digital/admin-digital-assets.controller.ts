import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { DigitalAssetsService } from './digital-assets.service';
import { ArchiveDigitalAssetDto } from './dto/archive-digital-asset.dto';
import { PatchDigitalAssetAccessDto } from './dto/patch-digital-asset-access.dto';

@ApiTags('digital-admin')
@Controller('admin/assets')
export class AdminDigitalAssetsController {
  constructor(private readonly digitalAssetsService: DigitalAssetsService) {}

  @RequirePermissions('digital.write')
  @Patch(':id/access')
  @ApiOperation({ summary: 'Update digital asset access policy or state' })
  async patchAccess(@Param('id') id: string, @Body() body: PatchDigitalAssetAccessDto) {
    const asset = await this.digitalAssetsService.patchAccess(id, body);
    return { data: asset };
  }

  @RequirePermissions('digital.write')
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a digital asset' })
  async archive(@Param('id') id: string, @Body() body: ArchiveDigitalAssetDto) {
    const asset = await this.digitalAssetsService.archiveAsset(id, body.expectedState);
    return { data: asset };
  }
}
