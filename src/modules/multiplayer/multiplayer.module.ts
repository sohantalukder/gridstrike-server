import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { GameGateway } from "./game.gateway";
import { MatchesController } from "./matches.controller";
import { MultiplayerService } from "./multiplayer.service";
import { RoomsController } from "./rooms.controller";

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: config.get("JWT_ACCESS_EXPIRES_IN") },
      }),
    }),
  ],
  controllers: [RoomsController, MatchesController],
  providers: [MultiplayerService, GameGateway],
  exports: [MultiplayerService],
})
export class MultiplayerModule {}
