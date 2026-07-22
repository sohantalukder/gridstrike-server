import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('GameConfig')
@Controller('api/v1/game-config')
export class AppConfigController {
  @Get()
  getConfig() {
    return {
      version: 4,
      enemySpeedMultiplier: 1.0,
      maxWave: 2,
      bossEnabled: true,
      pulseRifle: {
        damage: 15,
        fireRate: 0.2,
        projectileSpeed: 560,
        range: 420,
      },
    };
  }

  @Get('version')
  getVersion() {
    return { version: 4 };
  }
}
