import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/http/decorators/public.decorator';
import { CatalogPublicService } from './catalog-public.service';
import { PublicBookListQueryDto } from './dto/public-book-list-query.dto';

@ApiTags('catalog-public')
@Controller('books')
export class PublicBooksController {
  constructor(private readonly catalogPublicService: CatalogPublicService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published books for guests' })
  listBooks(@Query() query: PublicBookListQueryDto) {
    return this.catalogPublicService.listBooks(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get published book detail' })
  getBook(@Param('id') id: string) {
    return this.catalogPublicService.getBook(id);
  }
}
