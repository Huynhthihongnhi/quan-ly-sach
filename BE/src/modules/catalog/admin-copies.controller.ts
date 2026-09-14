import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CatalogAdminService } from './catalog-admin.service';
import { CreateCopyDto } from './dto/create-copy.dto';
import { TaxonomyListQueryDto } from './dto/taxonomy-list-query.dto';
import { UpdateCopyDto } from './dto/update-copy.dto';

@ApiTags('catalog-admin')
@Controller('admin')
export class AdminCopiesController {
  constructor(private readonly catalogAdminService: CatalogAdminService) {}

  @RequirePermissions('catalog.read')
  @Get('books/:id/copies')
  @ApiOperation({ summary: 'List copies for a book' })
  listCopies(@Param('id') bookId: string, @Query() query: TaxonomyListQueryDto) {
    return this.catalogAdminService.listCopies(bookId, query);
  }

  @RequirePermissions('copies.write')
  @Post('books/:id/copies')
  @ApiOperation({ summary: 'Add a physical copy' })
  async createCopy(
    @Param('id') bookId: string,
    @Body() body: CreateCopyDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const copy = await this.catalogAdminService.createCopy(
      bookId,
      body,
      req.actor!.userId,
      req.requestId,
    );
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/copies/${copy.id}`);
    return copy;
  }

  @RequirePermissions('copies.write')
  @Patch('copies/:id')
  @ApiOperation({ summary: 'Update copy shelf or condition' })
  updateCopy(
    @Param('id') copyId: string,
    @Body() body: UpdateCopyDto,
    @Req() req: RequestWithContext,
  ) {
    return this.catalogAdminService.updateCopy(copyId, body, req.actor!.userId, req.requestId);
  }
}
