import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

const WEAPONS = [
  {
    id: 'pulse-rifle',
    name: 'Pulse Rifle',
    damage: 15,
    fireRate: 0.2,
    projectileSpeed: 560,
    range: 420,
    spread: 0.06,
    reloadOrCooldownMs: 0,
    energyCost: 0,
    rarity: 'common',
    maxLevel: 5,
  },
  {
    id: 'plasma-shotgun',
    name: 'Plasma Shotgun',
    damage: 12,
    fireRate: 0.8,
    projectileSpeed: 360,
    range: 220,
    spread: 0.35,
    reloadOrCooldownMs: 1,
    energyCost: 0,
    rarity: 'rare',
    maxLevel: 5,
  },
  {
    id: 'arc-blaster',
    name: 'Arc Blaster',
    damage: 22,
    fireRate: 0.5,
    projectileSpeed: 620,
    range: 560,
    spread: 0.03,
    reloadOrCooldownMs: 0,
    energyCost: 5,
    rarity: 'epic',
    maxLevel: 6,
  },
];

@ApiTags('Weapons')
@Controller('api/v1/weapons')
export class WeaponsController {
  @Get()
  list() {
    return WEAPONS;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return WEAPONS.find((weapon) => weapon.id === id);
  }
}
