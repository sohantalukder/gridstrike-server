import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GuestDto } from './dto/guest.dto';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async issuePair(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = randomUUID();
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        username: dto.username,
        authMode: 'email',
      },
    });
    await this.prisma.playerProfile.create({
      data: { userId: user.id, displayName: dto.username },
    });
    return this.issuePair(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issuePair(user.id);
  }

  async guest(dto: GuestDto) {
    const username = dto.deviceId || `guest-${randomUUID().slice(0, 8)}`;
    const user = await this.prisma.user.create({
      data: {
        email: `${username}@guest.local`,
        username,
        passwordHash: null,
        authMode: 'guest',
      },
    });
    await this.prisma.playerProfile.create({
      data: { userId: user.id, displayName: username, rank: 1 },
    });
    return this.issuePair(user.id);
  }

  async refresh(dto: RefreshDto) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });

    const match = await Promise.all(
      tokens.map(async (item) => {
        const valid = await bcrypt.compare(dto.refreshToken, item.tokenHash);
        return valid ? item : null;
      }),
    );

    const found = match.find(Boolean);
    if (!found) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.update({
      where: { id: (found as any).id },
      data: { isRevoked: true },
    });

    return this.issuePair((found as any).userId);
  }

  async logout(refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({ where: { isRevoked: false } });
    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.tokenHash)) {
        await this.prisma.refreshToken.update({ where: { id: token.id }, data: { isRevoked: true } });
      }
    }
  }

  async me(userId: string) {
    return this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
  }
}
