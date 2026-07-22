import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(userId: string) {
    return this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId },
      include: { user: true },
    });
  }

  async getById(playerId: string) {
    return this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId: playerId },
      include: { user: true },
    });
  }

  async update(userId: string, dto: { displayName?: string; avatar?: string }) {
    return this.prisma.playerProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName ?? undefined,
        avatar: dto.avatar ?? undefined,
      },
    });
  }
}
