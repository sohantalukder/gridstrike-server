# Deterministic multiplayer protocol

The server owns a 60 Hz fixed simulation. Snapshots are emitted at 20 Hz and
persisted to Redis at that same cadence. Socket.IO event names remain
compatible.

## Client actions

- `socket:authenticate`
- `room:join`, `room:leave`, `room:ready`, `room:unready`
- `matchmaking:join`, `matchmaking:cancel`
- `match:loaded`
- `match:input`
- `match:fire`
- `match:ability`
- `match:surrender`
- `match:sync-request`
- `match:reconnect`
- `player:ping`

Every gameplay input uses a monotonically increasing input sequence. Fire and
ability requests use unique action IDs. Duplicate or invalid actions are
rejected without applying damage.

## Authoritative snapshot

Snapshots include server tick, position, velocity, facing, grounded state,
weapon, ammo, reload state, animation state, life state, scenario version,
score, health, match state, and authoritative damage events. Clients predict
local input, reconcile confirmed state, interpolate remote players, and request
a complete snapshot after reconnect.

The server validates movement speed, bounds, fire cadence, ammo/reload, range,
line of sight, hit region, damage, death, and completion. The parity headshot
multiplier is `1.0`.

## Recovery and completion

- Active match state, reconnect leases, and per-player active-match locks live
  in Redis.
- Reconnect lease: 30 seconds; expiry forfeits the disconnected player.
- Match timeout: 180 seconds.
- Timeout winner: remaining health, then score; exact equality is a draw.
- Existing REST, Prisma, Redis, and Socket.IO infrastructure is retained.
