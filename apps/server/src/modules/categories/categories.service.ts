import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      where: { status: 'active' },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });
  }
}
