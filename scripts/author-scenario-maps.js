/* eslint-disable no-console */
const { promises: fs } = require("node:fs");
const path = require("node:path");

const contentRoot = path.resolve(__dirname, "..", "scenario-content");
const mapWidth = 1920;
const mapHeight = 768;

const scenarios = {
  "neo-hive-loop": {
    chunks: [
      ["market-approach", "intro"],
      ["neon-alley", "combat"],
      ["electrified-service", "objective"],
      ["rooftop-relay", "combat"],
      ["communications-plaza", "boss"],
    ],
    hazards: ["electric", null, "electric", null, "electric"],
    props: ["barrier", "antenna", "bunker", "droneWreck"],
    enemies: ["rifleman", "drone", "turret"],
  },
  "metro-gridline": {
    chunks: [
      ["station-platform", "intro"],
      ["active-rail-tunnel", "combat"],
      ["maintenance-shaft", "objective"],
      ["service-junction", "combat"],
      ["extraction-concourse", "extraction"],
    ],
    hazards: [null, "rail", null, "rail", null],
    props: ["railSignal", "barrier", "bunker", "railSignal"],
    enemies: ["rifleman", "marksman", "turret"],
  },
  "carbon-works": {
    chunks: [
      ["foundry-floor", "intro"],
      ["steam-riser", "combat"],
      ["crane-deck", "objective"],
      ["furnace-lane", "combat"],
      ["generator-hall", "boss"],
    ],
    hazards: [null, "steam", null, "fire", "fire"],
    props: ["crane", "barrier", "bunker", "droneWreck"],
    enemies: ["heavy", "rifleman", "turret"],
  },
  "aurora-downtown": {
    chunks: [
      ["rooftop-approach", "intro"],
      ["construction-gap", "combat"],
      ["skybridge", "objective"],
      ["tower-roof", "combat"],
      ["commander-arena", "boss"],
    ],
    hazards: [null, "wind", "wind", null, "wind"],
    props: ["rooftopVent", "antenna", "barrier", "droneWreck"],
    enemies: ["marksman", "drone", "commander"],
  },
  "quantum-corridor": {
    chunks: [
      ["lab-entry", "intro"],
      ["blackout-corridor", "combat"],
      ["trip-laser-gallery", "objective"],
      ["core-access", "combat"],
      ["extraction-gate", "extraction"],
    ],
    hazards: [null, "shutter", "laser", "shutter", "laser"],
    props: ["labConsole", "barrier", "antenna", "labConsole"],
    enemies: ["drone", "turret", "commander"],
  },
};

const themes3d = {
  "neo-hive-loop": {
    skyColor: "#071426",
    laneWidth: 18,
    materials: [
      ["concrete", "#273449", 0.12, 0.78],
      ["structure", "#142238", 0.56, 0.38],
      ["cover", "#334155", 0.68, 0.34],
      ["accent", "#00D8FF", 0.3, 0.22],
      ["hazard", "#B7FF35", 0.12, 0.3],
    ],
  },
  "metro-gridline": {
    skyColor: "#050A13",
    laneWidth: 17,
    materials: [
      ["concrete", "#303744", 0.08, 0.9],
      ["structure", "#151A23", 0.7, 0.3],
      ["cover", "#424B57", 0.62, 0.42],
      ["accent", "#FFB020", 0.26, 0.26],
      ["hazard", "#FF3B30", 0.18, 0.22],
    ],
  },
  "carbon-works": {
    skyColor: "#160B07",
    laneWidth: 20,
    materials: [
      ["concrete", "#3F3630", 0.18, 0.84],
      ["structure", "#271B17", 0.82, 0.32],
      ["cover", "#55443A", 0.72, 0.38],
      ["accent", "#FF8A1F", 0.22, 0.24],
      ["hazard", "#FF3D00", 0.12, 0.18],
    ],
  },
  "aurora-downtown": {
    skyColor: "#08102B",
    laneWidth: 16,
    materials: [
      ["concrete", "#3A4355", 0.14, 0.7],
      ["structure", "#18243C", 0.66, 0.28],
      ["cover", "#52627A", 0.54, 0.34],
      ["accent", "#B487FF", 0.32, 0.2],
      ["hazard", "#73E8FF", 0.16, 0.16],
    ],
  },
  "quantum-corridor": {
    skyColor: "#030814",
    laneWidth: 15,
    materials: [
      ["concrete", "#202B3B", 0.22, 0.62],
      ["structure", "#0E1727", 0.76, 0.22],
      ["cover", "#2E4059", 0.64, 0.28],
      ["accent", "#25F4D4", 0.34, 0.16],
      ["hazard", "#FF2E88", 0.2, 0.14],
    ],
  },
};

function vector3(x, y, z) {
  return { x, y, z };
}

function object3d({
  id,
  kind,
  primitive = "box",
  position,
  size = vector3(1, 1, 1),
  materialId = "structure",
  archetype,
  damage,
  rotationY,
  metadata,
}) {
  return {
    id,
    kind,
    primitive,
    position,
    size,
    materialId,
    ...(archetype ? { archetype } : {}),
    ...(damage ? { damage } : {}),
    ...(rotationY ? { rotationY } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function geometry3dFor(scenarioId, config, chunk, index) {
  const theme = themes3d[scenarioId];
  const length = 40 + (index % 2) * 4;
  const width = theme.laneWidth;
  const objects = [
    object3d({
      id: `floor-${index}`,
      kind: "floor",
      position: vector3(0, -0.3, 0),
      size: vector3(width, 0.6, length),
      materialId: "concrete",
    }),
    object3d({
      id: `left-structure-${index}`,
      kind: "wall",
      position: vector3(-width / 2 - 0.4, 2.4, index % 2 ? -5 : 5),
      size: vector3(0.8, 4.8 + index, length * 0.72),
      materialId: "structure",
    }),
    object3d({
      id: `right-structure-${index}`,
      kind: "wall",
      position: vector3(width / 2 + 0.4, 2.1, index % 2 ? 6 : -4),
      size: vector3(0.8, 4.2 + index * 0.7, length * 0.68),
      materialId: "structure",
    }),
    object3d({
      id: `cover-${index}-a`,
      kind: "cover",
      position: vector3(-4 + index * 0.55, 0.72, -7 + index * 2),
      size: vector3(3.2, 1.44, 1.1 + index * 0.12),
      materialId: "cover",
      rotationY: index * 0.16,
    }),
    object3d({
      id: `cover-${index}-b`,
      kind: "cover",
      position: vector3(3.8 - index * 0.4, 0.86, 5 + index * 1.4),
      size: vector3(2.6 + index * 0.2, 1.72, 1.2),
      materialId: "cover",
      rotationY: -index * 0.12,
    }),
    object3d({
      id: `tower-${index}`,
      kind: "prop",
      primitive: index % 2 === 0 ? "cylinder" : "box",
      position: vector3(index % 2 === 0 ? 6.2 : -6, 2.8, -12 + index),
      size: vector3(1.6 + index * 0.15, 5.6 + index, 1.6),
      materialId: "structure",
    }),
    object3d({
      id: `signal-${index}`,
      kind: "prop",
      primitive: "cylinder",
      position: vector3(index % 2 === 0 ? -6.5 : 6.3, 1.3, 12 - index),
      size: vector3(1.1, 2.6, 1.1),
      materialId: "accent",
    }),
    object3d({
      id: `light-${index}-a`,
      kind: "light",
      position: vector3(-5, 4.8, -7),
      metadata: {
        color: theme.materials[3][1],
        intensity: 11 + index,
      },
    }),
    object3d({
      id: `light-${index}-b`,
      kind: "light",
      position: vector3(5, 4.2, 9),
      metadata: {
        color: index % 2 === 0 ? theme.materials[3][1] : "#FF6A2A",
        intensity: 9 + index,
      },
    }),
    object3d({
      id: `enemy-${index}-a`,
      kind: "enemy-spawn",
      position: vector3(-2.8 + index * 0.4, 0, 6 + index),
      archetype: config.enemies[index % config.enemies.length],
    }),
    object3d({
      id: `enemy-${index}-b`,
      kind: "enemy-spawn",
      position: vector3(3.2 - index * 0.3, 0, 13 + index * 0.5),
      archetype: config.enemies[(index + 1) % config.enemies.length],
    }),
  ];

  const hazard = config.hazards[index];
  if (hazard) {
    objects.push(
      object3d({
        id: `${hazard}-${index}`,
        kind: "hazard",
        primitive: hazard === "steam" ? "cylinder" : "box",
        position: vector3(index % 2 === 0 ? 0 : -1.5, 0.12, index * 1.8),
        size: vector3(
          hazard === "laser" ? 0.22 : 5.4,
          hazard === "laser" ? 3.4 : 0.24,
          hazard === "rail" ? 10 : 3,
        ),
        materialId: "hazard",
        damage: hazard === "fire" || hazard === "laser" ? 18 : 12,
      }),
    );
  }

  if (index === 4 && chunk[1] === "boss") {
    objects.push(
      object3d({
        id: `boss-${index}`,
        kind: "boss-spawn",
        position: vector3(0, 0, 15),
        archetype: "commander",
      }),
    );
  } else {
    objects.push(
      object3d({
        id: `objective-${index}`,
        kind: chunk[1] === "extraction" ? "extraction" : "objective",
        primitive: "cylinder",
        position: vector3(index % 2 === 0 ? 0 : 4.6, 1.4, 15),
        size: vector3(1.4, 2.8, 1.4),
        materialId: "accent",
      }),
    );
  }

  if (scenarioId === "aurora-downtown" && index === 1) {
    objects[0].size = vector3(width * 0.44, 0.6, length);
    objects.push(
      object3d({
        id: "construction-bridge",
        kind: "floor",
        position: vector3(4.6, 0.28, 4),
        size: vector3(4.4, 0.55, 13),
        materialId: "structure",
        rotationY: 0.12,
      }),
    );
  }

  if (scenarioId === "metro-gridline" && index === 1) {
    objects.push(
      object3d({
        id: "active-rail",
        kind: "hazard",
        position: vector3(0, 0.08, 0),
        size: vector3(2.8, 0.16, length),
        materialId: "hazard",
        damage: 20,
      }),
    );
  }

  if (scenarioId === "quantum-corridor" && index === 2) {
    for (let laser = -2; laser <= 2; laser += 1) {
      objects.push(
        object3d({
          id: `trip-laser-${laser + 2}`,
          kind: "hazard",
          position: vector3(laser * 2.1, 0.9 + (laser % 2) * 0.35, 3),
          size: vector3(0.12, 1.8, 0.12),
          materialId: "hazard",
          damage: 14,
        }),
      );
    }
  }
  return { length, objects };
}

function world3dFor(scenarioId, config) {
  const theme = themes3d[scenarioId];
  const ids = config.chunks.map(([id]) => id);
  return {
    enabled: true,
    renderer: "flame3d",
    laneWidth: theme.laneWidth,
    cameraFov: scenarioId === "aurora-downtown" ? 64 : 58,
    cameraDistance: scenarioId === "quantum-corridor" ? 9.5 : 11,
    fogDensity: scenarioId === "quantum-corridor" ? 0.04 : 0.018,
    skyColor: theme.skyColor,
    materials: theme.materials.map(
      ([id, color, metallic, roughness]) => ({
        id,
        color,
        metallic,
        roughness,
      }),
    ),
    chunks: config.chunks.map((chunk, index) => {
      const geometry = geometry3dFor(scenarioId, config, chunk, index);
      return {
        id: chunk[0],
        role: chunk[1],
        length: geometry.length,
        weight: chunk[1] === "combat" ? 1.2 : 1,
        allowedModes: [
          "practice",
          "survival",
          "missions",
          "dailyChallenge",
        ],
        objects: geometry.objects,
      };
    }),
    routes: {
      practice: ids,
      survival: ids,
      missions: ids,
      dailyChallenge: ids,
    },
  };
}

function object(name, type, x, y, width = 1, height = 1, properties = {}) {
  return { name, type, x, y, width, height, properties };
}

function geometryFor(index) {
  switch (index) {
    case 0:
      return [
        object("ground-main", "terrain", 0, 620, 1920, 148),
        object("cover-main", "cover", 620, 490, 280, 130),
      ];
    case 1:
      return [
        object("ground-west", "terrain", 0, 630, 790, 138),
        object("ground-east", "terrain", 960, 560, 960, 208),
        object("high-cover", "cover", 1120, 420, 340, 140),
      ];
    case 2:
      return [
        object("ground-main", "terrain", 0, 650, 1920, 118),
        object("upper-route", "terrain", 470, 430, 860, 44),
        object("route-cover", "cover", 760, 310, 250, 120),
      ];
    case 3:
      return [
        object("ground-entry", "terrain", 0, 640, 620, 128),
        object("middle-step", "terrain", 620, 560, 610, 208),
        object("high-step", "terrain", 1230, 485, 690, 283),
        object("step-cover", "cover", 910, 430, 190, 130),
      ];
    default:
      return [
        object("arena-floor", "terrain", 0, 600, 1920, 168),
        object("arena-cover-west", "cover", 430, 470, 230, 130),
        object("arena-cover-east", "cover", 1190, 430, 280, 170),
      ];
  }
}

function gameplayFor(config, chunk, index) {
  const objects = [
    object(
      `objective-${index + 1}`,
      index === 4 && chunk[1] === "extraction" ? "extraction" : "objective",
      index === 4 ? 1770 : 1500 + (index % 2) * 120,
      index === 2 ? 360 : 530 - index * 10,
    ),
    object(
      `enemy-${index}-a`,
      "enemy-spawn",
      900,
      index === 2 ? 350 : 550,
      1,
      1,
      { enemy: config.enemies[index % config.enemies.length] },
    ),
    object(
      `enemy-${index}-b`,
      "enemy-spawn",
      1330,
      index === 1 ? 480 : 520,
      1,
      1,
      { enemy: config.enemies[(index + 1) % config.enemies.length] },
    ),
    object("pickup-ammo", "pickup-ammo", 1080, 520),
  ];
  if (index === 4 && chunk[1] === "boss") {
    objects.push(object("boss", "boss-spawn", 1480, 500));
  }
  const hazard = config.hazards[index];
  if (hazard) {
    const hazardRect = {
      electric: [1030, 615, 250, 24],
      rail: [0, 650, 1920, 78],
      steam: [990, 570, 180, 56],
      fire: [1110, 545, 210, 58],
      wind: [760, 260, 280, 390],
      laser: [1120, 340, 18, 280],
      shutter: [920, 300, 94, 300],
    }[hazard];
    objects.push(
      object(
        `${hazard}-hazard`,
        hazard,
        hazardRect[0],
        hazardRect[1],
        hazardRect[2],
        hazardRect[3],
      ),
    );
  }
  return objects;
}

function propObjects(config, index) {
  return [
    object(
      `prop-${index}-a`,
      `prop-${config.props[index % config.props.length]}`,
      170 + index * 45,
      430,
      90,
      160,
      { scale: "0.9" },
    ),
    object(
      `prop-${index}-b`,
      `prop-${config.props[(index + 1) % config.props.length]}`,
      720 + index * 38,
      390,
      110,
      210,
      { scale: "1.05" },
    ),
    object(
      `prop-${index}-c`,
      `prop-${config.props[(index + 2) % config.props.length]}`,
      1580 - index * 42,
      440,
      100,
      170,
      { scale: "0.82" },
    ),
  ];
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderObject(item, id) {
  const properties = Object.entries(item.properties);
  const propertyXml =
    properties.length === 0
      ? ""
      : `\n   <properties>${properties
          .map(
            ([name, value]) =>
              `\n    <property name="${escapeXml(name)}" value="${escapeXml(value)}"/>`,
          )
          .join("")}\n   </properties>`;
  const point = item.width <= 1 && item.height <= 1 ? "\n   <point/>" : "";
  return `  <object id="${id}" name="${escapeXml(item.name)}" type="${escapeXml(item.type)}" x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}">${point}${propertyXml}\n  </object>`;
}

function renderGroup(name, items, state) {
  const content = items
    .map((item) => renderObject(item, state.nextObjectId++))
    .join("\n");
  return ` <objectgroup id="${state.nextLayerId++}" name="${name}">\n${content}\n </objectgroup>`;
}

function renderMap(config, chunk, index) {
  const state = { nextLayerId: 2, nextObjectId: 1 };
  const collision = geometryFor(index);
  const gameplay = gameplayFor(config, chunk, index);
  const navigation = [
    object("nav-start", "nav-start", 80, 540),
    object("nav-end", "nav-end", 1840, 500),
  ];
  const props = propObjects(config, index);
  const groups = [
    renderGroup("TerrainVisual", [], state),
    renderGroup("Collision", collision, state),
    renderGroup("Gameplay", gameplay, state),
    renderGroup("Navigation", navigation, state),
    renderGroup("PropsBack", props.slice(0, 2), state),
    renderGroup("PropsFront", props.slice(2), state),
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="30" height="12" tilewidth="64" tileheight="64" infinite="0" nextlayerid="${state.nextLayerId}" nextobjectid="${state.nextObjectId}">
 <properties>
  <property name="chunkId" value="${chunk[0]}"/>
  <property name="role" value="${chunk[1]}"/>
 </properties>
 <imagelayer id="1" name="ParallaxFar" visible="0">
  <image source="../backgrounds/environment.webp" width="1600" height="900"/>
 </imagelayer>
${groups}
</map>
`;
}

function routesFor(chunks) {
  const ids = chunks.map(([id]) => id);
  const combatPool = chunks
    .filter(([, role]) => role === "combat" || role === "objective")
    .map(([id]) => id);
  const boss = chunks.find(([, role]) => role === "boss")?.[0] ?? ids.at(-1);
  const extraction =
    chunks.find(([, role]) => role === "extraction")?.[0] ?? ids.at(-1);
  return {
    practice: {
      intro: ids[0],
      combatPool,
      missionSequence: [],
      boss,
      extraction,
      loop: true,
    },
    survival: {
      intro: ids[0],
      combatPool,
      missionSequence: [],
      boss,
      extraction,
      loop: true,
    },
    missions: {
      intro: ids[0],
      combatPool,
      missionSequence: ids,
      boss,
      extraction,
      loop: false,
    },
    dailyChallenge: {
      intro: ids[0],
      combatPool,
      missionSequence: [],
      boss,
      extraction,
      loop: true,
    },
  };
}

async function main() {
  for (const [scenarioId, config] of Object.entries(scenarios)) {
    const scenarioRoot = path.join(contentRoot, scenarioId);
    const mapsRoot = path.join(scenarioRoot, "maps");
    await fs.mkdir(mapsRoot, { recursive: true });
    for (let index = 0; index < config.chunks.length; index += 1) {
      const chunk = config.chunks[index];
      await fs.writeFile(
        path.join(mapsRoot, `${chunk[0]}.tmx`),
        renderMap(config, chunk, index),
        "utf8",
      );
    }

    const scenarioPath = path.join(scenarioRoot, "scenario.json");
    const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf8"));
    scenario.schemaVersion = 3;
    scenario.version = "3.0.0";
    scenario.world.chunkMaps = config.chunks.map(
      ([id]) => `maps/${id}.tmx`,
    );
    scenario.world.chunks = config.chunks.map(([id, role], index) => ({
      id,
      map: `maps/${id}.tmx`,
      role,
      weight: role === "combat" ? 1.2 : 1,
      allowedModes: [
        "practice",
        "survival",
        "missions",
        "dailyChallenge",
      ],
      order: index,
    }));
    scenario.world.routes = routesFor(config.chunks);
    scenario.world.parallax = [
      {
        path: "backgrounds/environment.webp",
        scrollFactor: 0.08,
        opacity: 1,
      },
    ];
    scenario.world3d = world3dFor(scenarioId, config);
    await fs.writeFile(
      scenarioPath,
      `${JSON.stringify(scenario, null, 2)}\n`,
      "utf8",
    );
    console.log(`${scenarioId}: authored ${config.chunks.length} maps`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
