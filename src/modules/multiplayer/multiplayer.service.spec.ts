import { MultiplayerService } from "./multiplayer.service";

describe("MultiplayerService authoritative simulation", () => {
  const createService = () => {
    const prisma = {
      playerProfile: {
        findUnique: jest.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve({ id: where.userId, displayName: where.userId }),
        ),
        update: jest.fn(),
      },
      multiplayerMatch: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      matchParticipant: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      gameResult: {
        upsert: jest.fn(),
      },
    };
    const config = { get: jest.fn(() => "test") };
    const redis = {
      setJson: jest.fn(() => Promise.resolve()),
      getJson: jest.fn(() => Promise.resolve(null)),
      setIfAbsent: jest.fn(() => Promise.resolve(true)),
      del: jest.fn(() => Promise.resolve()),
    };
    return {
      service: new MultiplayerService(
        prisma as never,
        config as never,
        redis as never,
      ),
      redis,
    };
  };

  const createActiveMatch = async (service: MultiplayerService) => {
    const room = await service.createRoom("alpha");
    await service.joinRoom("bravo", room.code);
    service.setReady("alpha", room.id, true);
    service.setReady("bravo", room.id, true);
    const match = service.startRoomMatch(room.id);
    expect(match).not.toBeNull();
    return service.markLoaded(match!.id)!;
  };

  it("runs side-scrolling movement on a fixed authoritative tick", async () => {
    const { service } = createService();
    const match = await createActiveMatch(service);
    const startX = match.players[0].x;
    expect(
      service.applyInput(match.id, "alpha", "move-1", 1, {
        movement: { x: 1 },
      }).accepted,
    ).toBe(true);
    for (let tick = 0; tick < 60; tick += 1) {
      service.tickAll(match.lastTickAt + 17);
    }
    expect(match.serverTick).toBe(60);
    expect(match.players[0].x).toBeGreaterThan(startX);
    expect(match.players[0].velocityX).toBeLessThanOrEqual(
      MultiplayerService.maximumSpeed,
    );
  });

  it("rejects duplicate actions and emits one authoritative damage event", async () => {
    const { service } = createService();
    const match = await createActiveMatch(service);
    const accepted = service.applyInput(match.id, "alpha", "shot-1", 1, {
      aim: { x: 1, y: 0 },
      isFiring: true,
    });
    const duplicate = service.applyInput(match.id, "alpha", "shot-1", 2, {
      isFiring: true,
    });
    expect(accepted.accepted).toBe(true);
    expect(duplicate).toMatchObject({
      accepted: false,
      reason: "duplicate-action",
    });
    expect(match.players[1].health).toBe(88);
    expect(match.players[0].magazine).toBe(23);
    expect(match.damageEvents).toHaveLength(1);
    expect(match.damageEvents[0]).toMatchObject({
      actionId: "shot-1",
      hitRegion: "torso",
      damage: 12,
    });
  });

  it("uses health then score at the 180 second timeout and persists Redis state", async () => {
    const { service, redis } = createService();
    const match = await createActiveMatch(service);
    match.players[0].health = 75;
    match.players[1].health = 64;
    match.timeoutAt = 1;
    service.tickAll(2);
    expect(match.status).toBe("finished");
    expect(match.winnerId).toBe("alpha");
    expect(match.draw).toBe(false);
    expect(redis.setJson).toHaveBeenCalled();
  });

  it("forfeits a disconnected player after the reconnect lease", async () => {
    const { service } = createService();
    const match = await createActiveMatch(service);
    match.players[0].connected = false;
    match.players[0].disconnectedAt =
      Date.now() - MultiplayerService.reconnectLeaseMs - 1;
    service.tickAll(Date.now());
    expect(match.status).toBe("finished");
    expect(match.winnerId).toBe("bravo");
  });
});
