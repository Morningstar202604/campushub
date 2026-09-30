import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('categories')
@ApiTags('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** 公开：内容分类（active，按 sort） */
  @Get()
  list() {
    return this.categories.list();
  }
}
