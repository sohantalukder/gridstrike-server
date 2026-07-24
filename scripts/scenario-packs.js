/* eslint-disable no-console */
require("dotenv").config();

const { createHash } = require("node:crypto");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const { zipSync } = require("fflate");

const projectRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(projectRoot, "scenario-content");
const outputRoot = path.join(projectRoot, "build", "scenario-packs");
const manifestPath = path.join(
  projectRoot,
  "src",
  "modules",
  "missions",
  "scenario-pack-manifest.json",
);
const maxPackBytes = 18 * 1024 * 1024;
const maxExpandedBytes = 200 * 1024 * 1024;
const upload = process.argv.includes("--upload");
const scenarioModes = ["practice", "survival", "missions", "dailyChallenge"];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateScenarioWorld(scenarioId, scenario, files) {
  const world = scenario.world;
  if (!world || !Array.isArray(world.chunks) || world.chunks.length < 5) {
    throw new Error(
      `${scenarioId} must publish at least five authored chunks.`,
    );
  }
  const chunkIds = new Set();
  for (const chunk of world.chunks) {
    if (
      !chunk ||
      typeof chunk.id !== "string" ||
      typeof chunk.map !== "string" ||
      chunkIds.has(chunk.id)
    ) {
      throw new Error(`${scenarioId} contains an invalid or duplicate chunk.`);
    }
    chunkIds.add(chunk.id);
    const source = files[chunk.map];
    if (!source) {
      throw new Error(`${scenarioId} is missing authored map ${chunk.map}.`);
    }
    const tmx = Buffer.from(source).toString("utf8");
    for (const layer of [
      'name="TerrainVisual"',
      'name="Collision"',
      'name="Gameplay"',
      'name="Navigation"',
      'name="PropsBack"',
      'name="PropsFront"',
    ]) {
      if (!tmx.includes(layer)) {
        throw new Error(`${chunk.map} is missing required layer ${layer}.`);
      }
    }
    if (!tmx.includes('type="terrain"')) {
      throw new Error(`${chunk.map} has no playable terrain.`);
    }
  }
  if (!world.routes || typeof world.routes !== "object") {
    throw new Error(`${scenarioId} is missing scenario routes.`);
  }
  for (const mode of scenarioModes) {
    const route = world.routes[mode];
    if (!route || !chunkIds.has(route.intro)) {
      throw new Error(`${scenarioId} has an invalid ${mode} intro route.`);
    }
    for (const id of [
      ...(route.combatPool || []),
      ...(route.missionSequence || []),
      route.boss,
      route.extraction,
    ].filter(Boolean)) {
      if (!chunkIds.has(id)) {
        throw new Error(
          `${scenarioId} route ${mode} references unknown chunk ${id}.`,
        );
      }
    }
  }

  const world3d = scenario.world3d;
  if (
    !world3d ||
    world3d.enabled !== true ||
    !Array.isArray(world3d.materials) ||
    world3d.materials.length < 4 ||
    !Array.isArray(world3d.chunks) ||
    world3d.chunks.length < 5
  ) {
    throw new Error(`${scenarioId} is missing its authored 3D world.`);
  }
  const chunk3dIds = new Set();
  const geometrySignatures = new Set();
  for (const chunk of world3d.chunks) {
    if (
      !chunk ||
      typeof chunk.id !== "string" ||
      chunk3dIds.has(chunk.id) ||
      !Array.isArray(chunk.objects) ||
      chunk.objects.length < 8
    ) {
      throw new Error(`${scenarioId} contains an invalid 3D chunk.`);
    }
    chunk3dIds.add(chunk.id);
    if (!chunk.objects.some((item) => item.kind === "floor")) {
      throw new Error(`${scenarioId}/${chunk.id} has no 3D floor.`);
    }
    if (
      !chunk.objects.some((item) =>
        ["enemy-spawn", "boss-spawn", "objective", "extraction"].includes(
          item.kind,
        ),
      )
    ) {
      throw new Error(`${scenarioId}/${chunk.id} has no gameplay objects.`);
    }
    for (const item of chunk.objects) {
      const position = item.position;
      const size = item.size;
      if (
        !item.id ||
        !item.kind ||
        !position ||
        ![position.x, position.y, position.z].every(Number.isFinite) ||
        (size && ![size.x, size.y, size.z].every(Number.isFinite))
      ) {
        throw new Error(`${scenarioId}/${chunk.id} has invalid 3D geometry.`);
      }
    }
    geometrySignatures.add(
      chunk.objects
        .filter((item) =>
          ["floor", "wall", "cover", "hazard"].includes(item.kind),
        )
        .map(
          (item) =>
            `${item.kind}:${item.position.x}:${item.position.z}:${item.size?.x}:${item.size?.z}`,
        )
        .join("|"),
    );
  }
  if (geometrySignatures.size !== world3d.chunks.length) {
    throw new Error(`${scenarioId} repeats the same 3D map geometry.`);
  }
  for (const mode of scenarioModes) {
    const route = world3d.routes?.[mode];
    if (
      !Array.isArray(route) ||
      route.length === 0 ||
      route.some((id) => !chunk3dIds.has(id))
    ) {
      throw new Error(`${scenarioId} has an invalid 3D ${mode} route.`);
    }
  }

  if (scenario.schemaVersion === 4) {
    if (world3d.renderer !== "thermion") {
      throw new Error(`${scenarioId} v4 must use the Thermion renderer.`);
    }
    const requiredArchetypes = [
      "operator",
      "rifleman",
      "marksman",
      "heavy",
      "drone",
      "turret",
      "commander",
    ];
    const requiredNodes = [
      "root",
      "pelvis",
      "spine",
      "neck",
      "head",
      "right_hand",
      "weapon_root",
      "muzzle",
      "hit_head",
      "hit_torso",
    ];
    const requiredAnimations = [
      "idle",
      "run",
      "jump",
      "fall",
      "fire",
      "reload",
      "hit",
      "death",
      "respawn",
    ];
    const models = new Map(
      (world3d.characterModels || []).map((model) => [model.archetype, model]),
    );
    for (const archetype of requiredArchetypes) {
      const model = models.get(archetype);
      if (
        !model ||
        typeof model.modelPath !== "string" ||
        !model.modelPath.endsWith(".glb") ||
        !files[model.modelPath]
      ) {
        throw new Error(
          `${scenarioId} is missing ${archetype} production GLB.`,
        );
      }
      const nodes = new Set(model.rig?.nodes || []);
      const animations = new Set(model.rig?.animations || []);
      if (requiredNodes.some((node) => !nodes.has(node))) {
        throw new Error(`${scenarioId}/${archetype} has an incomplete rig.`);
      }
      if (requiredAnimations.some((name) => !animations.has(name))) {
        throw new Error(
          `${scenarioId}/${archetype} has incomplete skeletal animations.`,
        );
      }
      const parents = model.rig?.parents || {};
      if (
        parents.head !== "neck" ||
        parents.neck !== "spine" ||
        parents.spine !== "pelvis" ||
        parents.pelvis !== "root"
      ) {
        throw new Error(
          `${scenarioId}/${archetype} has an invalid head ancestry.`,
        );
      }
    }
  }
}

function deterministicZip(files) {
  return Buffer.from(
    zipSync(files, {
      level: 9,
      mtime: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );
}

function groupV4Files(files) {
  const groups = {
    core: {},
    models: {},
    maps: {},
    audio: {},
    optional: {},
  };
  for (const [relative, bytes] of Object.entries(files)) {
    const group =
      relative === "scenario.json"
        ? "core"
        : relative.startsWith("models/")
          ? "models"
          : relative.startsWith("maps/") || relative.startsWith("maps3d/")
            ? "maps"
            : relative.startsWith("audio/")
              ? "audio"
              : "optional";
    groups[group][relative] = bytes;
  }
  return groups;
}

async function collectFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(root, absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (relative === "preview.webp") continue;
    if (relative.includes("..") || path.isAbsolute(relative)) {
      throw new Error(`Unsafe scenario-pack path: ${relative}`);
    }
    files[relative] = new Uint8Array(await fs.readFile(absolute));
  }
  return files;
}

function getSupabaseStorageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SCENARIO_ASSET_BUCKET || "gridstrike-scenarios";
  if (!baseUrl || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY are required for --upload.",
    );
  }
  return { baseUrl, key, bucket };
}

function supabaseStorageHeaders(key, extra = {}) {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    ...extra,
  };
}

async function ensureBucket(baseUrl, key, bucket) {
  const response = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: supabaseStorageHeaders(key, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      name: bucket,
      public: true,
      file_size_limit: maxPackBytes,
    }),
  });
  if (response.ok) {
    return;
  }
  if (response.status === 409) {
    return;
  }
  const body = await response.text();
  if (response.status === 400 && body.includes('"statusCode":"409"')) {
    return;
  }
  throw new Error(
    `Failed to ensure storage bucket "${bucket}": ${response.status} ${body}`,
  );
}

async function uploadObject(objectPath, body, contentType) {
  const { baseUrl, key, bucket } = getSupabaseStorageConfig();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: supabaseStorageHeaders(key, {
        "Content-Type": contentType,
        "x-upsert": "false",
        "cache-control": "31536000",
      }),
      body,
    },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(
      `Upload failed for ${objectPath}: ${response.status} ${await response.text()}`,
    );
  }
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });
  const sourceEntries = await fs.readdir(contentRoot, { withFileTypes: true });
  const manifest = {};

  if (upload) {
    const { baseUrl, key, bucket } = getSupabaseStorageConfig();
    await ensureBucket(baseUrl, key, bucket);
  }

  for (const sourceEntry of sourceEntries) {
    if (!sourceEntry.isDirectory()) continue;
    const scenarioId = sourceEntry.name;
    const scenarioRoot = path.join(contentRoot, scenarioId);
    const scenarioJsonPath = path.join(scenarioRoot, "scenario.json");
    const previewPath = path.join(scenarioRoot, "preview.webp");
    const scenario = JSON.parse(await fs.readFile(scenarioJsonPath, "utf8"));
    if (
      scenario.id !== scenarioId ||
      ![3, 4].includes(scenario.schemaVersion)
    ) {
      throw new Error(
        `${scenarioId}/scenario.json must use matching id and schemaVersion 3 or 4.`,
      );
    }
    const version = String(scenario.version || "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(
        `${scenarioId} has invalid semantic version "${version}".`,
      );
    }

    const files = await collectFiles(scenarioRoot);
    if (!files["scenario.json"]) {
      throw new Error(`${scenarioId} is missing scenario.json.`);
    }
    validateScenarioWorld(scenarioId, scenario, files);
    const expandedBytes = Object.values(files).reduce(
      (total, bytes) => total + bytes.byteLength,
      0,
    );
    if (expandedBytes > maxExpandedBytes) {
      throw new Error(`${scenarioId} exceeds the 200 MB expanded-size limit.`);
    }

    const zip = deterministicZip(files);
    if (zip.byteLength > maxPackBytes) {
      throw new Error(`${scenarioId} exceeds the 18 MB compressed-size limit.`);
    }
    const preview = await fs.readFile(previewPath);
    const scenarioOutput = path.join(outputRoot, scenarioId, version);
    await fs.mkdir(scenarioOutput, { recursive: true });
    await fs.writeFile(path.join(scenarioOutput, "scenario.zip"), zip);
    await fs.copyFile(previewPath, path.join(scenarioOutput, "preview.webp"));

    const bundleDescriptors = [];
    if (scenario.schemaVersion === 4) {
      for (const [group, groupFiles] of Object.entries(groupV4Files(files))) {
        if (Object.keys(groupFiles).length === 0) continue;
        const bundle = deterministicZip(groupFiles);
        if (bundle.byteLength > maxPackBytes) {
          throw new Error(`${scenarioId}/${group} exceeds the 18 MB limit.`);
        }
        const id = `${group}-${version}`;
        await fs.writeFile(path.join(scenarioOutput, `${id}.zip`), bundle);
        bundleDescriptors.push({
          id,
          group,
          requiredForPlay: group !== "optional",
          sha256: sha256(bundle),
          sizeBytes: bundle.byteLength,
        });
        if (upload) {
          await uploadObject(
            `${scenarioId}/${version}/${id}.zip`,
            bundle,
            "application/zip",
          );
        }
      }
    }

    manifest[scenarioId] = {
      schemaVersion: scenario.schemaVersion,
      version,
      packSha256: sha256(zip),
      packSizeBytes: zip.byteLength,
      expandedSizeBytes: expandedBytes,
      previewSha256: sha256(preview),
      previewSizeBytes: preview.byteLength,
      ...(bundleDescriptors.length > 0 ? { bundles: bundleDescriptors } : {}),
    };

    if (upload) {
      const prefix = `${scenarioId}/${version}`;
      await uploadObject(`${prefix}/scenario.zip`, zip, "application/zip");
      await uploadObject(`${prefix}/preview.webp`, preview, "image/webp");
    }
    console.log(
      `${scenarioId}@${version}: ${zip.byteLength} bytes, sha256=${manifest[scenarioId].packSha256}`,
    );
  }

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`Updated ${path.relative(projectRoot, manifestPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
