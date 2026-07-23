import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';

const MISSIONS = [
  { id: 'defeat-30', title: 'Defeat 30 enemies', objective: 'defeatEnemies', target: 30, rewardXp: 120, rewardCoins: 80 },
  { id: 'capture-3', title: 'Capture three nodes', objective: 'captureNodes', target: 3, rewardXp: 150, rewardCoins: 110 },
  { id: 'survive-5m', title: 'Survive 5 minutes', objective: 'surviveSeconds', target: 300, rewardXp: 200, rewardCoins: 180 },
];

const SCENARIO_MAPS = [
  {
    id: 'neo-hive-loop',
    title: 'Neo Hive Loop',
    description: 'Neon-lit vertical markets and drone corridors with rotating patrol routes.',
    gameType: 'missions',
    previewTone: '#56F2FF',
    sectorNames: ['HIVE LOOP', 'NEON CANOPY', 'DRONE DOCK'],
    seed: 'neo_hive_loop',
    mapTags: ['NEON CITY', 'AERIAL ROUTES', 'COMBAT LAYER'],
    visualProfile: {
      skyTop: '#07122A',
      skyBottom: '#153B68',
      groundTop: '#1A2A45',
      groundBottom: '#0F1A2F',
      accent: '#56F2FF',
      landmarkTone: '#5EDBFF',
      glowTone: '#89F7FF',
    },
  },
  {
    id: 'metro-gridline',
    title: 'Metro Gridline',
    description: 'Underground transit vaults with reactive laser rails and high-speed side runs.',
    gameType: 'missions',
    previewTone: '#B8FF7A',
    sectorNames: ['RING PLATFORM', 'GLASS MAZE', 'TRANSIT LANE'],
    seed: 'metro_gridline',
    mapTags: ['SUBTERRANEAN', 'LIGHT RUSH', 'LINE SHIFT'],
    visualProfile: {
      skyTop: '#0B1230',
      skyBottom: '#192A59',
      groundTop: '#1F3052',
      groundBottom: '#121F3C',
      accent: '#B8FF7A',
      landmarkTone: '#9DFE83',
      glowTone: '#E4FFB6',
    },
  },
  {
    id: 'carbon-works',
    title: 'Carbon Works',
    description: 'A storm-hazed industrial complex with crane towers and thermal exhaust vents.',
    gameType: 'missions',
    previewTone: '#FFB74D',
    sectorNames: ['STEAM RISER', 'RAIL FOUNDRY', 'OVERHEAD CRANE'],
    seed: 'carbon_works',
    mapTags: ['INDUSTRIAL CORE', 'THERMAL FOG', 'AERIAL PRESSURE'],
    visualProfile: {
      skyTop: '#1B1A18',
      skyBottom: '#382D2B',
      groundTop: '#4B3A36',
      groundBottom: '#2B2422',
      accent: '#FFB74D',
      landmarkTone: '#FFC97A',
      glowTone: '#FFE0A9',
    },
  },
  {
    id: 'aurora-downtown',
    title: 'Aurora Downtown',
    description: 'Corporate skyline district with mirrored towers, smart turrets, and rapid transitions.',
    gameType: 'missions',
    previewTone: '#B06DFF',
    sectorNames: ['SKYLINE PROMENADE', 'POLAR SPAN', 'TOWER BRIDGE'],
    seed: 'aurora_downtown',
    mapTags: ['HIGH-RISE', 'POLAR SKY', 'CORELINE'],
    visualProfile: {
      skyTop: '#1F1550',
      skyBottom: '#3A3B7A',
      groundTop: '#2A2E66',
      groundBottom: '#1A1F4B',
      accent: '#B06DFF',
      landmarkTone: '#D8A0FF',
      glowTone: '#F0D6FF',
    },
  },
  {
    id: 'quantum-corridor',
    title: 'Quantum Corridor',
    description: 'Secure research spine with moving nodes, plasma shutters, and low-visibility choke points.',
    gameType: 'missions',
    previewTone: '#7CD7FF',
    sectorNames: ['LAB ENTRY', 'HYPER TUNNEL', 'CORE CHOKE'],
    seed: 'quantum_corridor',
    mapTags: ['RESEARCH BELT', 'VISIBILITY DROP', 'PLASMA GATES'],
    visualProfile: {
      skyTop: '#09172D',
      skyBottom: '#0F2950',
      groundTop: '#183766',
      groundBottom: '#122245',
      accent: '#7CD7FF',
      landmarkTone: '#90EEFF',
      glowTone: '#B4FAFF',
    },
  },
];

@ApiTags('Missions')
@Controller('api/v1/missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MissionsController {
  @Get()
  list() {
    return MISSIONS;
  }

  @Get('scenario-maps')
  scenarioMaps() {
    return SCENARIO_MAPS;
  }

  @Get('active')
  active(@ReqUser() user: { userId: string }) {
    return { ...MISSIONS[0], playerId: user.userId };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return MISSIONS.find((mission) => mission.id === id);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @ReqUser() user: { userId: string }) {
    return { claimed: true, missionId: id, playerId: user.userId };
  }
}
