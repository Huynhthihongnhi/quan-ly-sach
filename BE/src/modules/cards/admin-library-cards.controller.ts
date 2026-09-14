import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CardsService } from './cards.service';
import { IssueLibraryCardDto } from './dto/issue-library-card.dto';
import { LibraryCardListQueryDto } from './dto/library-card-list-query.dto';
import { UpdateLibraryCardStateDto } from './dto/update-library-card-state.dto';

@ApiTags('cards-admin')
@Controller('admin/library-cards')
export class AdminLibraryCardsController {
  constructor(private readonly cardsService: CardsService) {}

  @RequirePermissions('cards.read')
  @Get()
  @ApiOperation({ summary: 'List library cards for staff' })
  listCards(@Query() query: LibraryCardListQueryDto) {
    return this.cardsService.listAdminCards(query);
  }

  @RequirePermissions('cards.write')
  @Post()
  @ApiOperation({ summary: 'Issue a library card to a user' })
  async issueCard(
    @Body() body: IssueLibraryCardDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const card = await this.cardsService.issueCard(body, req.actor!.userId, req.requestId);
    res.status(201);
    res.setHeader('Location', `/api/v1/admin/library-cards/${card.id}`);
    return card;
  }

  @RequirePermissions('cards.write')
  @Patch(':id/state')
  @ApiOperation({ summary: 'Update library card state' })
  updateCardState(
    @Param('id') id: string,
    @Body() body: UpdateLibraryCardStateDto,
    @Req() req: RequestWithContext,
  ) {
    return this.cardsService.updateCardState(id, body, req.actor!.userId, req.requestId);
  }
}
