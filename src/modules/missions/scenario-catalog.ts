export type ScenarioMode =
  "practice" | "survival" | "missions" | "dailyChallenge";

export type ScenarioEnemyId =
  "rifleman" | "marksman" | "heavy" | "drone" | "turret" | "commander";

export interface ScenarioCatalogEntry {
  schemaVersion: 3 | 4;
  id: string;
  title: string;
  description: string;
  gameType: "all";
  allowedModes: ScenarioMode[];
  previewTone: string;
  sectorNames: string[];
  seed: string;
  mapTags: string[];
  visualProfile: {
    skyTop: string;
    skyBottom: string;
    groundTop: string;
    groundBottom: string;
    accent: string;
    landmarkTone: string;
    glowTone: string;
  };
  missionContext: {
    objectiveHint: string;
    threatLevel: number;
    environment: string;
    enemyIntel: ScenarioEnemyId[];
    hazards: string[];
    modifiers: string[];
  };
  preview: {
    url: string;
    sha256: string;
    sizeBytes: number;
  };
  pack: {
    version: string;
    url: string;
    sha256: string;
    sizeBytes: number;
    expandedSizeBytes: number;
    minClientVersion: string;
  };
  contentBundles: Array<{
    id: string;
    group: "core" | "models" | "maps" | "audio" | "optional";
    version: string;
    requiredForPlay: boolean;
    url: string;
    sha256: string;
    sizeBytes: number;
  }>;
  requires3DUpdate: boolean;
  cacheVersion: string;
}

interface ScenarioPackManifestEntry {
  schemaVersion?: 3 | 4;
  version: string;
  packSha256: string;
  packSizeBytes: number;
  expandedSizeBytes?: number;
  previewSha256: string;
  previewSizeBytes: number;
  bundles?: Array<{
    id: string;
    group: "core" | "models" | "maps" | "audio" | "optional";
    requiredForPlay: boolean;
    sha256: string;
    sizeBytes: number;
  }>;
}

export type ScenarioPackManifest = Record<string, ScenarioPackManifestEntry>;

const allowedModes: ScenarioMode[] = [
  "practice",
  "survival",
  "missions",
  "dailyChallenge",
];

const definitions = [
  {
    id: "neo-hive-loop",
    title: "Neo Hive Loop",
    description:
      "Rain-soaked market alleys and fortified rooftops under hostile patrol control.",
    previewTone: "#879A8A",
    sectorNames: ["MARKET APPROACH", "ROOFTOP RELAY", "SERVICE ALLEY"],
    seed: "neo_hive_loop_v3",
    mapTags: ["RAIN", "URBAN", "ELECTRIFIED"],
    visualProfile: {
      skyTop: "#111820",
      skyBottom: "#29343C",
      groundTop: "#4E554F",
      groundBottom: "#242A28",
      accent: "#B6C9B8",
      landmarkTone: "#7F9386",
      glowTone: "#C9D4C6",
    },
    objectiveHint: "Secure five communication relays",
    threatLevel: 3,
    environment: "Rainy fortified market district",
    enemyIntel: ["rifleman", "drone", "turret"],
    hazards: ["Electrified puddles", "Restricted visibility"],
    modifiers: ["Movement +5%", "Reload duration +10%", "Visibility -18%"],
  },
  {
    id: "metro-gridline",
    title: "Metro Gridline",
    description:
      "Abandoned stations, maintenance tunnels, and active high-voltage rail lanes.",
    previewTone: "#A5A99B",
    sectorNames: ["RING PLATFORM", "SERVICE SHAFT", "TRANSIT LANE"],
    seed: "metro_gridline_v3",
    mapTags: ["SUBTERRANEAN", "RAIL HAZARD", "FAST ROUTE"],
    visualProfile: {
      skyTop: "#101417",
      skyBottom: "#282E30",
      groundTop: "#565C58",
      groundBottom: "#252927",
      accent: "#D3D5C9",
      landmarkTone: "#8E968E",
      glowTone: "#E6E1C8",
    },
    objectiveHint: "Reach extraction through seven sectors",
    threatLevel: 4,
    environment: "Underground military transit network",
    enemyIntel: ["rifleman", "marksman", "turret"],
    hazards: ["Timed active rails", "Confined firing lanes"],
    modifiers: [
      "Movement +10%",
      "Jump -5%",
      "Weapon spread -8%",
      "Ability cooldown +5%",
    ],
  },
  {
    id: "carbon-works",
    title: "Carbon Works",
    description:
      "A fortified foundry of crane decks, furnace lanes, and armored checkpoints.",
    previewTone: "#C08454",
    sectorNames: ["STEAM RISER", "RAIL FOUNDRY", "CRANE DECK"],
    seed: "carbon_works_v3",
    mapTags: ["FOUNDRY", "THERMAL", "HEAVY UNITS"],
    visualProfile: {
      skyTop: "#181614",
      skyBottom: "#3A302A",
      groundTop: "#55483E",
      groundBottom: "#29231F",
      accent: "#D89B63",
      landmarkTone: "#A5734C",
      glowTone: "#E8B882",
    },
    objectiveHint: "Destroy three defended generators",
    threatLevel: 4,
    environment: "Industrial foundry and freight yard",
    enemyIntel: ["heavy", "rifleman", "turret"],
    hazards: ["Steam vents", "Furnace fire zones"],
    modifiers: [
      "Movement -8%",
      "Weapon damage +10%",
      "Reload duration +8%",
      "Reserve ammo +15%",
    ],
  },
  {
    id: "aurora-downtown",
    title: "Aurora Downtown",
    description:
      "Exposed rooftops and construction skybridges watched by precision units.",
    previewTone: "#8596A8",
    sectorNames: ["SKYLINE APPROACH", "POLAR SPAN", "TOWER BRIDGE"],
    seed: "aurora_downtown_v3",
    mapTags: ["ROOFTOP", "CROSSWIND", "MARKSMEN"],
    visualProfile: {
      skyTop: "#18202A",
      skyBottom: "#465462",
      groundTop: "#4A5156",
      groundBottom: "#252A2E",
      accent: "#B9C8D3",
      landmarkTone: "#8A9AA7",
      glowTone: "#DCE5E9",
    },
    objectiveHint: "Collect four intel nodes and eliminate the commander",
    threatLevel: 5,
    environment: "Wind-exposed corporate rooftops",
    enemyIntel: ["marksman", "drone", "commander"],
    hazards: ["Crosswind", "Long rooftop gaps"],
    modifiers: [
      "Jump +10%",
      "Weapon spread +12%",
      "Projectile speed -5%",
      "Ability cooldown -8%",
    ],
  },
  {
    id: "quantum-corridor",
    title: "Quantum Corridor",
    description:
      "An experimental defense laboratory with blackout sectors and automated security.",
    previewTone: "#77908E",
    sectorNames: ["LAB ENTRY", "SECURITY SPINE", "CORE ACCESS"],
    seed: "quantum_corridor_v3",
    mapTags: ["LAB", "BLACKOUT", "AUTOMATED DEFENSE"],
    visualProfile: {
      skyTop: "#0E1517",
      skyBottom: "#243134",
      groundTop: "#3B4A4A",
      groundBottom: "#1D2627",
      accent: "#9CB5AF",
      landmarkTone: "#718B87",
      glowTone: "#C4D5CF",
    },
    objectiveHint: "Sabotage the defense core and reach extraction",
    threatLevel: 5,
    environment: "Experimental underground defense laboratory",
    enemyIntel: ["drone", "turret", "commander"],
    hazards: ["Security shutters", "Trip lasers", "Blackout sectors"],
    modifiers: [
      "Visibility -30%",
      "Movement -4%",
      "Ability cooldown -15%",
      "Shield duration +15%",
      "Reserve ammo -15%",
    ],
  },
] as const;

const emptyManifest: ScenarioPackManifestEntry = {
  schemaVersion: 3,
  version: "3.0.0",
  packSha256: "",
  packSizeBytes: 0,
  expandedSizeBytes: 0,
  previewSha256: "",
  previewSizeBytes: 0,
};

export function buildScenarioCatalog(
  assetBaseUrl: string,
  manifest: ScenarioPackManifest = {},
): ScenarioCatalogEntry[] {
  const base = assetBaseUrl.replace(/\/+$/, "");
  return definitions.map((definition) => {
    const files = manifest[definition.id] ?? emptyManifest;
    const versionPath = `${definition.id}/${files.version}`;
    return {
      schemaVersion: files.schemaVersion ?? 3,
      id: definition.id,
      title: definition.title,
      description: definition.description,
      gameType: "all",
      allowedModes: [...allowedModes],
      previewTone: definition.previewTone,
      sectorNames: [...definition.sectorNames],
      seed: definition.seed,
      mapTags: [...definition.mapTags],
      visualProfile: definition.visualProfile,
      missionContext: {
        objectiveHint: definition.objectiveHint,
        threatLevel: definition.threatLevel,
        environment: definition.environment,
        enemyIntel: [...definition.enemyIntel],
        hazards: [...definition.hazards],
        modifiers: [...definition.modifiers],
      },
      preview: {
        url: `${base}/${versionPath}/preview.webp`,
        sha256: files.previewSha256,
        sizeBytes: files.previewSizeBytes,
      },
      pack: {
        version: files.version,
        url: `${base}/${versionPath}/scenario.zip`,
        sha256: files.packSha256,
        sizeBytes: files.packSizeBytes,
        expandedSizeBytes: files.expandedSizeBytes ?? 0,
        minClientVersion: "0.2.0",
      },
      contentBundles: (files.bundles ?? []).map((bundle) => ({
        ...bundle,
        version: files.version,
        url: `${base}/${versionPath}/${bundle.id}.zip`,
      })),
      requires3DUpdate: (files.schemaVersion ?? 3) < 4,
      cacheVersion: files.version,
    };
  });
}
