import { readFileSync } from "node:fs";
import path from "node:path";

import manifest from "./scenario-pack-manifest.json";
import { buildScenarioCatalog, ScenarioPackManifest } from "./scenario-catalog";

describe("scenario v3 catalog", () => {
  const catalog = buildScenarioCatalog(
    "https://assets.example.test/gridstrike-scenarios/",
    manifest as ScenarioPackManifest,
  );

  it("publishes all five immutable, verified scenario packs", () => {
    expect(catalog).toHaveLength(5);
    for (const scenario of catalog) {
      expect(scenario.schemaVersion).toBe(3);
      expect(scenario.requires3DUpdate).toBe(true);
      expect(scenario.contentBundles).toEqual([]);
      expect(scenario.pack.minClientVersion).toBe("0.2.0");
      expect(scenario.allowedModes).toEqual([
        "practice",
        "survival",
        "missions",
        "dailyChallenge",
      ]);
      expect(scenario.preview.url).toContain(
        `/${scenario.id}/${scenario.pack.version}/preview.webp`,
      );
      expect(scenario.pack.url).toContain(
        `/${scenario.id}/${scenario.pack.version}/scenario.zip`,
      );
      expect(scenario.pack.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(scenario.preview.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(scenario.pack.sizeBytes).toBeGreaterThan(0);
      expect(scenario.pack.expandedSizeBytes).toBeGreaterThan(
        scenario.pack.sizeBytes,
      );
      expect(scenario.preview.sizeBytes).toBeGreaterThan(0);
    }
  });

  it("publishes v4 bundle groups without changing scenario IDs", () => {
    const v4Manifest: ScenarioPackManifest = {
      ...(manifest as ScenarioPackManifest),
      "neo-hive-loop": {
        ...manifest["neo-hive-loop"],
        schemaVersion: 4 as const,
        version: "4.0.0",
        bundles: [
          {
            id: "models-4.0.0",
            group: "models" as const,
            requiredForPlay: true,
            sha256: "a".repeat(64),
            sizeBytes: 1024,
          },
        ],
      },
    };
    const [scenario] = buildScenarioCatalog(
      "https://assets.example.test/gridstrike-scenarios/",
      v4Manifest,
    );
    expect(scenario.id).toBe("neo-hive-loop");
    expect(scenario.schemaVersion).toBe(4);
    expect(scenario.requires3DUpdate).toBe(false);
    expect(scenario.contentBundles[0]).toMatchObject({
      group: "models",
      version: "4.0.0",
      requiredForPlay: true,
    });
    expect(scenario.contentBundles[0].url).toContain(
      "/neo-hive-loop/4.0.0/models-4.0.0.zip",
    );
  });

  it("keeps legacy compatibility fields", () => {
    for (const scenario of catalog) {
      expect(scenario.gameType).toBe("all");
      expect(scenario.visualProfile).toBeDefined();
      expect(scenario.missionContext.objectiveHint).not.toHaveLength(0);
      expect(scenario.id).not.toHaveLength(0);
    }
  });

  it("ships five validated, geometrically distinct playable maps per scenario", () => {
    for (const scenario of catalog) {
      const root = path.resolve(
        __dirname,
        "../../../scenario-content",
        scenario.id,
      );
      const runtime = JSON.parse(
        readFileSync(path.join(root, "scenario.json"), "utf8"),
      ) as {
        world: {
          chunks: Array<{ id: string; map: string }>;
          routes: Record<string, { intro: string; combatPool: string[] }>;
        };
        world3d: {
          materials: Array<{ id: string }>;
          chunks: Array<{
            id: string;
            objects: Array<{
              kind: string;
              position: { x: number; y: number; z: number };
              size?: { x: number; y: number; z: number };
            }>;
          }>;
          routes: Record<string, string[]>;
        };
      };
      expect(runtime.world.chunks).toHaveLength(5);
      expect(new Set(runtime.world.chunks.map((chunk) => chunk.id)).size).toBe(
        5,
      );
      for (const mode of [
        "practice",
        "survival",
        "missions",
        "dailyChallenge",
      ]) {
        expect(runtime.world.routes[mode].intro).toBeTruthy();
        expect(runtime.world.routes[mode].combatPool.length).toBeGreaterThan(0);
      }

      const collisionLayouts = runtime.world.chunks.map((chunk) => {
        const tmx = readFileSync(path.join(root, chunk.map), "utf8");
        expect(tmx).toContain('name="TerrainVisual"');
        expect(tmx).toContain('name="Collision"');
        expect(tmx).toContain('name="Gameplay"');
        expect(tmx).toContain('name="Navigation"');
        expect(tmx).toContain('type="terrain"');
        return [...tmx.matchAll(/type="terrain" x="([^"]+)" y="([^"]+)"/g)]
          .map((match) => `${match[1]}:${match[2]}`)
          .join("|");
      });
      expect(new Set(collisionLayouts).size).toBe(5);
      expect(runtime.world3d.materials.length).toBeGreaterThanOrEqual(4);
      expect(runtime.world3d.chunks).toHaveLength(5);
      for (const chunk of runtime.world3d.chunks) {
        expect(chunk.objects.some((item) => item.kind === "floor")).toBe(true);
        expect(
          chunk.objects.some((item) =>
            ["enemy-spawn", "boss-spawn", "objective", "extraction"].includes(
              item.kind,
            ),
          ),
        ).toBe(true);
      }
      const geometry3d = runtime.world3d.chunks.map((chunk) =>
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
      expect(new Set(geometry3d).size).toBe(5);
      for (const mode of [
        "practice",
        "survival",
        "missions",
        "dailyChallenge",
      ]) {
        expect(runtime.world3d.routes[mode]).toHaveLength(5);
      }
    }
  });
});
