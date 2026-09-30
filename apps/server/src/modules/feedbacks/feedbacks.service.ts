import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';

@Injectable()
export class FeedbacksService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, dto: CreateFeedbackDto) {
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        content: dto.content,
        contact: dto.contact ?? '',
      },
    });
    return { id: feedback.id, createdAt: feedback.createdAt };
  }
}
