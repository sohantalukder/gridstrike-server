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
const maxPackBytes = 25 * 1024 * 1024;
const maxExpandedBytes = 80 * 1024 * 1024;
const upload = process.argv.includes("--upload");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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
    if (scenario.id !== scenarioId || scenario.schemaVersion !== 2) {
      throw new Error(
        `${scenarioId}/scenario.json must use matching id and schemaVersion 2.`,
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
    const expandedBytes = Object.values(files).reduce(
      (total, bytes) => total + bytes.byteLength,
      0,
    );
    if (expandedBytes > maxExpandedBytes) {
      throw new Error(`${scenarioId} exceeds the 80 MB expanded-size limit.`);
    }

    const zip = Buffer.from(zipSync(files, { level: 9 }));
    if (zip.byteLength > maxPackBytes) {
      throw new Error(`${scenarioId} exceeds the 25 MB compressed-size limit.`);
    }
    const preview = await fs.readFile(previewPath);
    const scenarioOutput = path.join(outputRoot, scenarioId, version);
    await fs.mkdir(scenarioOutput, { recursive: true });
    await fs.writeFile(path.join(scenarioOutput, "scenario.zip"), zip);
    await fs.copyFile(previewPath, path.join(scenarioOutput, "preview.webp"));

    manifest[scenarioId] = {
      version,
      packSha256: sha256(zip),
      packSizeBytes: zip.byteLength,
      previewSha256: sha256(preview),
      previewSizeBytes: preview.byteLength,
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
