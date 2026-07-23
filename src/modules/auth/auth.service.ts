import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { GuestDto } from "./dto/guest.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { AvailabilityDto } from "./dto/availability.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeUsername(username: string) {
    return username.trim();
  }

  private emailLookup(email: string) {
    return { email: { equals: email, mode: Prisma.QueryMode.insensitive } };
  }

  private async issuePair(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.get("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get("JWT_ACCESS_EXPIRES_IN"),
      },
    );

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

  async availability(dto: AvailabilityDto) {
    const email = dto.email ? this.normalizeEmail(dto.email) : undefined;
    const username = dto.username
      ? this.normalizeUsername(dto.username)
      : undefined;

    const [emailUser, usernameUser] = await Promise.all([
      email
        ? this.prisma.user.findFirst({ where: this.emailLookup(email) })
        : null,
      username
        ? this.prisma.user.findFirst({ where: { username, authMode: "email" } })
        : null,
    ]);

    return {
      emailAvailable: email ? emailUser === null : null,
      usernameAvailable: username ? usernameUser === null : null,
    };
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const username = this.normalizeUsername(dto.username);
    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findFirst({ where: this.emailLookup(email) }),
      this.prisma.user.findFirst({ where: { username, authMode: "email" } }),
    ]);
    const conflicts: string[] = [];
    if (existingEmail) conflicts.push("Email is already in use.");
    if (existingUsername) conflicts.push("Commander name is already in use.");
    if (conflicts.length > 0) throw new ConflictException(conflicts);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          username,
          authMode: "email",
        },
      });
      await this.prisma.playerProfile.create({
        data: { userId: user.id, displayName: username },
      });
      return this.issuePair(user.id);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          "Email or commander name is already in use.",
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: this.emailLookup(email),
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    return this.issuePair(user.id);
  }

  async guest(dto: GuestDto) {
    const username = dto.deviceId || `guest-${randomUUID().slice(0, 8)}`;
    const user = await this.prisma.user.create({
      data: {
        email: `${username}@guest.local`,
        username,
        passwordHash: null,
        authMode: "guest",
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
      orderBy: { createdAt: "desc" },
    });

    const match = await Promise.all(
      tokens.map(async (item) => {
        const valid = await bcrypt.compare(dto.refreshToken, item.tokenHash);
        return valid ? item : null;
      }),
    );

    const found = match.find(Boolean);
    if (!found) throw new UnauthorizedException("Invalid refresh token");

    await this.prisma.refreshToken.update({
      where: { id: (found as any).id },
      data: { isRevoked: true },
    });

    return this.issuePair((found as any).userId);
  }

  async logout(refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { isRevoked: false },
    });
    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.tokenHash)) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { isRevoked: true },
        });
      }
    }
  }

  async me(userId: string) {
    return this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
