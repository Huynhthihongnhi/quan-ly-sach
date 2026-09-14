import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { CatalogAdminService } from './catalog-admin.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateNamedTaxonomyDto } from './dto/create-named-taxonomy.dto';
import { PatchTaxonomyDto } from './dto/patch-taxonomy.dto';
import { TaxonomyListQueryDto } from './dto/taxonomy-list-query.dto';

@ApiTags('catalog-admin')
@Controller('admin')
export class AdminTaxonomyController {
  constructor(private readonly catalogAdminService: CatalogAdminService) {}

  @RequirePermissions('catalog.read')
  @Get('categories')
  listCategories(@Query() query: TaxonomyListQueryDto) {
    return this.catalogAdminService.listCategories(query);
  }

  @RequirePermissions('catalog.write')
  @Post('categories')
  async createCategory(@Body() body: CreateCategoryDto, @Res({ passthrough: true }) res: Response) {
    const category = await this.catalogAdminService.createCategory(body);
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/categories/${category.id}`);
    return category;
  }

  @RequirePermissions('catalog.write')
  @Patch('categories/:id')
  patchCategory(@Param('id') id: string, @Body() body: PatchTaxonomyDto) {
    return this.catalogAdminService.patchCategory(id, body);
  }

  @RequirePermissions('catalog.write')
  @HttpCode(204)
  @SkipResponseEnvelope()
  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.catalogAdminService.deleteCategory(id);
  }

  @RequirePermissions('catalog.read')
  @Get('authors')
  listAuthors(@Query() query: TaxonomyListQueryDto) {
    return this.catalogAdminService.listAuthors(query);
  }

  @RequirePermissions('catalog.write')
  @Post('authors')
  async createAuthor(
    @Body() body: CreateNamedTaxonomyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const author = await this.catalogAdminService.createAuthor(body);
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/authors/${author.id}`);
    return author;
  }

  @RequirePermissions('catalog.write')
  @Patch('authors/:id')
  patchAuthor(@Param('id') id: string, @Body() body: PatchTaxonomyDto) {
    return this.catalogAdminService.patchAuthor(id, body);
  }

  @RequirePermissions('catalog.write')
  @HttpCode(204)
  @SkipResponseEnvelope()
  @Delete('authors/:id')
  async deleteAuthor(@Param('id') id: string) {
    await this.catalogAdminService.deleteAuthor(id);
  }

  @RequirePermissions('catalog.read')
  @Get('topics')
  listTopics(@Query() query: TaxonomyListQueryDto) {
    return this.catalogAdminService.listTopics(query);
  }

  @RequirePermissions('catalog.write')
  @Post('topics')
  async createTopic(
    @Body() body: CreateNamedTaxonomyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const topic = await this.catalogAdminService.createTopic(body);
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/topics/${topic.id}`);
    return topic;
  }

  @RequirePermissions('catalog.write')
  @Patch('topics/:id')
  patchTopic(@Param('id') id: string, @Body() body: PatchTaxonomyDto) {
    return this.catalogAdminService.patchTopic(id, body);
  }

  @RequirePermissions('catalog.write')
  @HttpCode(204)
  @SkipResponseEnvelope()
  @Delete('topics/:id')
  async deleteTopic(@Param('id') id: string) {
    await this.catalogAdminService.deleteTopic(id);
  }
}
