import { Controller, Get, Param, Query } from '@nestjs/common';
import { GuidesService } from './guides.service.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('guides')
@ApiTags('guides')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get('categories')
  categories() {
    return this.guides.categories();
  }

  @Get()
  list(@Query('categoryId') categoryId?: string) {
    return this.guides.list(categoryId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.guides.detail(id);
  }
}
