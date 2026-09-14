import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { DigitalAssetsService } from './digital-assets.service';
import { UploadDigitalAssetDto } from './dto/upload-digital-asset.dto';

interface UploadedPdfFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

@ApiTags('digital-admin')
@Controller('admin/books')
export class AdminBookDigitalAssetsController {
  constructor(private readonly digitalAssetsService: DigitalAssetsService) {}

  @RequirePermissions('digital.write')
  @Post(':bookId/assets')
  @ApiOperation({ summary: 'Upload a PDF digital asset for a book' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(
    @Param('bookId') bookId: string,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @Body() body: UploadDigitalAssetDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) {
      throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'file is required.');
    }

    const asset = await this.digitalAssetsService.uploadPdfForBook({
      bookId,
      file: {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      rightsNote: body.rightsNote,
      uploadedBy: req.actor!.userId,
    });

    res.status(201);
    res.setHeader('Location', `/api/v1/admin/assets/${asset.id}/access`);
    return { data: asset };
  }
}
