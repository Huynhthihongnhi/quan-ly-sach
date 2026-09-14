import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionRoute } from '../../common/http/decorators/session-route.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CardsService } from './cards.service';
import { LibraryCardListQueryDto } from './dto/library-card-list-query.dto';

@ApiTags('me')
@Controller('me/library-cards')
export class MeLibraryCardsController {
  constructor(private readonly cardsService: CardsService) {}

  @SessionRoute()
  @Get()
  @ApiOperation({ summary: 'List library cards for the signed-in user' })
  listOwnCards(@Req() req: RequestWithContext, @Query() query: LibraryCardListQueryDto) {
    return this.cardsService.listOwnCards(req.actor!.userId, query);
  }
}
