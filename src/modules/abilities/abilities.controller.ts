import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

const ABILITIES = [
  { id: 'dash', name: 'Dash', cooldownMs: 3500, energyCost: 15, durationMs: 500, range: 220 },
  { id: 'shield', name: 'Energy Shield', cooldownMs: 8000, energyCost: 24, durationMs: 3000, range: 0 },
  { id: 'emp', name: 'EMP Blast', cooldownMs: 12000, energyCost: 32, durationMs: 800, range: 220 },
  { id: 'drone', name: 'Drone Strike', cooldownMs: 15000, energyCost: 42, durationMs: 1000, range: 300 },
];

@ApiTags('Abilities')
@Controller('api/v1/abilities')
export class AbilitiesController {
  @Get()
  list() {
    return ABILITIES;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return ABILITIES.find((a) => a.id === id);
  }
}
