import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PlayerSettingsModule } from './modules/player-settings/player-settings.module';
import { WeaponsModule } from './modules/weapons/weapons.module';
import { AbilitiesModule } from './modules/abilities/abilities.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LoadoutsModule } from './modules/loadouts/loadouts.module';
import { MissionsModule } from './modules/missions/missions.module';
import { DailyChallengesModule } from './modules/daily-challenges/daily-challenges.module';
import { GameResultsModule } from './modules/game-results/game-results.module';
import { MatchHistoryModule } from './modules/match-history/match-history.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { MultiplayerModule } from './modules/multiplayer/multiplayer.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueuesModule } from './infrastructure/queues/queues.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { EnvironmentVariables, pickEnvConfig } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        const parsed = plainToInstance(EnvironmentVariables, pickEnvConfig(config), {
          enableImplicitConversion: true,
        });
        const errors = validateSync(parsed, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length > 0) {
          throw new Error(errors.toString());
        }
        return parsed;
      },
    }),
    PrismaModule,
    RedisModule,
    QueuesModule,
    AuthModule,
    ProfilesModule,
    PlayerSettingsModule,
    WeaponsModule,
    AbilitiesModule,
    InventoryModule,
    LoadoutsModule,
    MissionsModule,
    DailyChallengesModule,
    GameResultsModule,
    MatchHistoryModule,
    LeaderboardsModule,
    RewardsModule,
    AchievementsModule,
    MultiplayerModule,
    AppConfigModule,
    HealthModule,
  ],
})
export class AppModule {}
