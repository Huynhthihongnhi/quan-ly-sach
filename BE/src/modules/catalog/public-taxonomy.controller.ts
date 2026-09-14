import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/http/decorators/public.decorator';
import { CatalogPublicService } from './catalog-public.service';
import { TaxonomyListQueryDto } from './dto/taxonomy-list-query.dto';

@ApiTags('catalog-public')
@Controller()
export class PublicTaxonomyController {
  constructor(private readonly catalogPublicService: CatalogPublicService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List categories used by published books' })
  listCategories(@Query() query: TaxonomyListQueryDto) {
    return this.catalogPublicService.listCategories(query);
  }

  @Public()
  @Get('authors')
  @ApiOperation({ summary: 'List authors used by published books' })
  listAuthors(@Query() query: TaxonomyListQueryDto) {
    return this.catalogPublicService.listAuthors(query);
  }

  @Public()
  @Get('topics')
  @ApiOperation({ summary: 'List topics used by published books' })
  listTopics(@Query() query: TaxonomyListQueryDto) {
    return this.catalogPublicService.listTopics(query);
  }
}
