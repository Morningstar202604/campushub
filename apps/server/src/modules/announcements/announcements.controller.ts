import { Controller, Get, Query } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('announcements')
@ApiTags('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.announcements.list(Number(limit) || 5);
  }
}
