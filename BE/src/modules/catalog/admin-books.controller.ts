import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CatalogAdminService } from './catalog-admin.service';
import { AdminBookListQueryDto } from './dto/admin-book-list-query.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateBookStateDto } from './dto/update-book-state.dto';

@ApiTags('catalog-admin')
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly catalogAdminService: CatalogAdminService) {}

  @RequirePermissions('catalog.read')
  @Get()
  @ApiOperation({ summary: 'List books for CMS' })
  listBooks(@Query() query: AdminBookListQueryDto) {
    return this.catalogAdminService.listBooks(query);
  }

  @RequirePermissions('catalog.read')
  @Get(':id')
  @ApiOperation({ summary: 'Get book metadata for CMS' })
  getBook(@Param('id') id: string) {
    return this.catalogAdminService.getBook(id);
  }

  @RequirePermissions('catalog.write')
  @Post()
  @ApiOperation({ summary: 'Create draft book' })
  async createBook(
    @Body() body: CreateBookDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const book = await this.catalogAdminService.createBook(body, req.actor!.userId, req.requestId);
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/books/${book.id}`);
    return book;
  }

  @RequirePermissions('catalog.write')
  @Patch(':id/state')
  @ApiOperation({ summary: 'Publish or archive a book' })
  updateBookState(
    @Param('id') id: string,
    @Body() body: UpdateBookStateDto,
    @Req() req: RequestWithContext,
  ) {
    return this.catalogAdminService.updateBookState(id, body, req.actor!.userId, req.requestId);
  }

  @RequirePermissions('catalog.write')
  @Patch(':id')
  @ApiOperation({ summary: 'Update book metadata' })
  updateBook(@Param('id') id: string, @Body() body: UpdateBookDto, @Req() req: RequestWithContext) {
    return this.catalogAdminService.updateBook(id, body, req.actor!.userId, req.requestId);
  }
}
