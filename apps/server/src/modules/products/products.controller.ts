import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateProductDto,
  ProductQuery,
  UpdateProductDto,
  UpdateProductStatusDto,
  ReportProductDto,
} from './dto/products.dto.js';

type AuthedUser = { sub: string };

@Controller('products')
@ApiTags('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() q: ProductQuery) {
    return this.products.list(q);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  my(
    @CurrentUser() user: AuthedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.products.myProducts(
      user.sub,
      Number(page) || 1,
      Math.min(50, Number(pageSize) || 20),
    );
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.detail(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateProductDto) {
    return this.products.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user.sub, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard)
  updateStatus(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.products.updateStatus(user.sub, id, dto.status);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  softDelete(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.products.softDelete(user.sub, id);
  }

  @Post(':id/report')
  @UseGuards(AuthGuard)
  report(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: ReportProductDto,
  ) {
    return this.products.report(user.sub, id, dto);
  }
}
