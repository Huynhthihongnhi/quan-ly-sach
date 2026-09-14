import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/http/decorators/public.decorator';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { DigitalAssetsService } from './digital-assets.service';

@ApiTags('digital-content')
@Controller('digital-assets')
export class DigitalContentController {
  constructor(private readonly digitalAssetsService: DigitalAssetsService) {}

  @Public()
  @SkipResponseEnvelope()
  @Get(':id/read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Stream inline PDF content when read policy allows' })
  async read(
    @Param('id') id: string,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    const slice = await this.digitalAssetsService.openContentForRead({
      assetId: id,
      actorUserId: req.actor?.userId ?? null,
      rangeHeader: req.headers.range,
    });

    res.status(slice.statusCode);
    res.setHeader('Content-Type', slice.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${slice.filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    if (slice.contentRange) {
      res.setHeader('Content-Range', slice.contentRange);
    }
    res.send(slice.body);
  }

  @RequirePermissions('digital.download.own')
  @SkipResponseEnvelope()
  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Download PDF when policy and card rules allow' })
  async download(
    @Param('id') id: string,
    @Req() req: RequestWithContext,
    @Res() res: Response,
  ): Promise<void> {
    const slice = await this.digitalAssetsService.openContentForDownload({
      assetId: id,
      actorUserId: req.actor!.userId,
    });

    res.status(200);
    res.setHeader('Content-Type', slice.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${slice.filename}"`);
    res.send(slice.body);
  }
}
