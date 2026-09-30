import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('search')
@ApiTags('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  all(
    @Query('keyword') keyword = '',
    @Query('tab') tab?: string,
    @Query('limit') limit?: string,
  ) {
    return this.search.all(keyword, tab, Number(limit) || 20);
  }
}
