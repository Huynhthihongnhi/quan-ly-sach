import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiException } from '../../common/http/api.exception';
import { Public } from '../../common/http/decorators/public.decorator';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/http/dto/pagination-query.dto';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { parseSortParam } from '../../common/http/pagination/sort-allowlist';
import { CreateDemoItemDto } from './dto/create-demo-item.dto';
import { DemoItemResponseDto } from './dto/demo-item-response.dto';

const DEMO_SORT_ALLOWLIST = ['id', 'label'] as const;
const LARGE_ID = '9223372036854775807';

@ApiTags('contract-demo')
@Controller('demo')
export class ContractDemoController {
  @Public()
  @Get('catalog')
  @ApiOperation({ summary: 'Public catalog sample for contract verification' })
  listCatalog(@Query() query: PaginationQueryDto): {
    data: DemoItemResponseDto[];
    meta: ReturnType<typeof buildPageMeta>;
  } {
    try {
      parseSortParam(query.sort, DEMO_SORT_ALLOWLIST);
    } catch {
      throw new UnprocessableEntityException('Sort field is not allowed.');
    }

    const items: DemoItemResponseDto[] = [
      { id: '1', label: 'Public sample A', version: '1' },
      { id: LARGE_ID, label: 'Public sample B', version: '2' },
    ];

    const start = (query.page - 1) * query.pageSize;
    const pageItems = items.slice(start, start + query.pageSize);

    return {
      data: pageItems,
      meta: buildPageMeta(query.page, query.pageSize, items.length),
    };
  }

  @Public()
  @Post('items')
  @ApiOperation({ summary: 'Public mutation sample for validation contract' })
  createItem(@Body() body: CreateDemoItemDto): DemoItemResponseDto {
    return {
      id: '100',
      label: body.label,
      version: '1',
    };
  }

  @RequirePermissions('demo.read')
  @Get('admin')
  @ApiOperation({ summary: 'Protected sample requiring demo.read permission' })
  getAdminPanel(): { message: string } {
    return { message: 'Protected admin panel sample.' };
  }

  @RequirePermissions('demo.read')
  @Get('resources/:id')
  @ApiOperation({ summary: 'Protected resource lookup with uniform 404' })
  getResource(@Param('id') id: string): DemoItemResponseDto {
    if (id !== '100') {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Resource was not found.');
    }

    return {
      id: '100',
      label: 'Protected resource',
      version: '3',
    };
  }

  @Public()
  @Get('resources/:id/public-shadow')
  @ApiOperation({ summary: 'Public route that hides missing resources as 404' })
  getPublicShadow(@Param('id') id: string): DemoItemResponseDto {
    if (id !== '100') {
      throw new NotFoundException('Resource was not found.');
    }

    return {
      id: '100',
      label: 'Visible public resource',
      version: '1',
    };
  }
}
