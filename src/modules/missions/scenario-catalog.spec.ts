import manifest from "./scenario-pack-manifest.json";
import { buildScenarioCatalog } from "./scenario-catalog";

describe("scenario v2 catalog", () => {
  const catalog = buildScenarioCatalog(
    "https://assets.example.test/gridstrike-scenarios/",
    manifest,
  );

  it("publishes all five immutable, verified scenario packs", () => {
    expect(catalog).toHaveLength(5);
    for (const scenario of catalog) {
      expect(scenario.schemaVersion).toBe(2);
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
      expect(scenario.preview.sizeBytes).toBeGreaterThan(0);
    }
  });

  it("keeps legacy compatibility fields", () => {
    for (const scenario of catalog) {
      expect(scenario.gameType).toBe("all");
      expect(scenario.visualProfile).toBeDefined();
      expect(scenario.missionContext.objectiveHint).not.toHaveLength(0);
      expect(scenario.id).not.toHaveLength(0);
    }
  });
});
