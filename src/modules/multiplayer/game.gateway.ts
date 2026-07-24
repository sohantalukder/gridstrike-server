import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { MultiplayerService } from "./multiplayer.service";

type AuthenticatedSocket = Socket & { playerId?: string };

@WebSocketGateway({ namespace: "/game", cors: true })
export class GameGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly countdowns = new Set<string>();
  private readonly playerSockets = new Map<string, string>();
  private simulationTimer?: NodeJS.Timeout;

  constructor(
    private readonly jwt: JwtService,
    private readonly multiplayer: MultiplayerService,
  ) {}

  @WebSocketServer()
  server!: Server;

  onModuleInit() {
    const intervalMs = Math.round(1000 / MultiplayerService.simulationHz);
    this.simulationTimer = setInterval(() => {
      const matches = this.multiplayer.tickAll();
      for (const match of matches) {
        if (match.serverTick % 3 === 0) {
          this.server
            .to(match.id)
            .emit("match:snapshot", this.multiplayer.snapshot(match));
        }
        if (match.status === "finished") {
          this.server
            .to(match.id)
            .emit("match:finished", this.multiplayer.snapshot(match));
        }
      }
    }, intervalMs);
    this.simulationTimer.unref();
  }

  onModuleDestroy() {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
  }

  handleConnection(client: AuthenticatedSocket) {
    client.emit("server:pong", { connected: true, serverTime: Date.now() });
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (
      client.playerId &&
      this.playerSockets.get(client.playerId) === client.id
    ) {
      this.playerSockets.delete(client.playerId);
    }
    const affected = this.multiplayer.disconnectSocket(client.id);
    for (const match of affected) {
      this.server
        .to(match.id)
        .emit("match:player-disconnected", this.multiplayer.snapshot(match));
    }
  }

  @SubscribeMessage("socket:authenticate")
  async authenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { token?: string },
  ) {
    try {
      const payload = this.jwt.verify(body.token ?? "");
      const playerId = payload.sub as string;
      client.playerId = playerId;
      this.playerSockets.set(playerId, client.id);
      this.multiplayer.markSocket(playerId, client.id);
      client.emit("socket:authenticated", { playerId });
    } catch {
      client.emit("server:error", {
        code: "AUTH_FAILED",
        message: "Socket authentication failed.",
      });
    }
  }

  @SubscribeMessage("room:join")
  async joinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; code?: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const room = body.code
      ? await this.multiplayer.joinRoom(client.playerId, body.code)
      : body.roomId
        ? this.multiplayer.getRoom(body.roomId)
        : null;
    if (!room) return client.emit("server:error", { code: "ROOM_NOT_FOUND" });
    client.join(room.id);
    this.multiplayer.markSocket(client.playerId, client.id);
    this.server.to(room.id).emit("room:updated", room);
  }

  @SubscribeMessage("room:leave")
  leaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const room = this.multiplayer.leaveRoom(client.playerId, body.roomId);
    client.leave(body.roomId);
    this.server.to(body.roomId).emit("room:player-left", room);
  }

  @SubscribeMessage("room:ready")
  ready(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string; loadoutId?: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const room = this.multiplayer.setReady(
      client.playerId,
      body.roomId,
      true,
      body.loadoutId,
    );
    if (!room) return client.emit("server:error", { code: "ROOM_NOT_READY" });
    this.server.to(room.id).emit("room:ready-updated", room);
    const match = this.multiplayer.startRoomMatch(room.id);
    if (match) this.startMatchCountdown(match.id, room.id);
  }

  @SubscribeMessage("room:unready")
  unready(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const room = this.multiplayer.setReady(client.playerId, body.roomId, false);
    if (room) this.server.to(room.id).emit("room:ready-updated", room);
  }

  @SubscribeMessage("matchmaking:join")
  async joinMatchmaking(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.playerId) return this.authRequired(client);
    const result = await this.multiplayer.joinRanked(
      client.playerId,
      client.id,
    );
    if (result.queued) {
      return client.emit("matchmaking:queued", result.entry);
    }
    if (result.match) {
      for (const player of result.match.players) {
        const socketId = this.playerSockets.get(player.playerId);
        if (socketId) {
          this.server.sockets.sockets.get(socketId)?.join(result.match.id);
        }
      }
      this.server
        .to(result.match.id)
        .emit("matchmaking:found", this.multiplayer.snapshot(result.match));
      this.startMatchCountdown(result.match.id, result.match.id);
    }
  }

  @SubscribeMessage("matchmaking:cancel")
  cancelMatchmaking(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.playerId) return this.authRequired(client);
    client.emit("matchmaking:updated", {
      cancelled: this.multiplayer.cancelRanked(client.playerId),
    });
  }

  @SubscribeMessage("match:loaded")
  loaded(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    client.join(body.matchId);
    const match = this.multiplayer.markLoaded(body.matchId);
    if (match) {
      client.emit("match:reconnect-lease", {
        matchId: match.id,
        token: this.multiplayer.reconnectToken(client.playerId, match.id),
        expiresInSeconds: 30,
      });
      this.server
        .to(body.matchId)
        .emit("match:started", this.multiplayer.snapshot(match));
    }
  }

  @SubscribeMessage("match:input")
  input(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { matchId: string; actionId: string; sequence: number; payload: any },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const result = this.multiplayer.applyInput(
      body.matchId,
      client.playerId,
      body.actionId,
      body.sequence,
      body.payload,
    );
    if (!result.accepted || !result.match)
      return client.emit("match:action-rejected", result);
    const match = result.match;
    client.emit("match:action-confirmed", {
      actionId: body.actionId,
      sequence: body.sequence,
    });
    if (match.status === "finished") {
      this.server
        .to(body.matchId)
        .emit("match:finished", this.multiplayer.snapshot(match));
    }
  }

  @SubscribeMessage("match:fire")
  fire(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      matchId: string;
      actionId: string;
      sequence: number;
      payload?: any;
    },
  ) {
    return this.input(client, {
      ...body,
      payload: { ...(body.payload ?? {}), isFiring: true },
    });
  }

  @SubscribeMessage("match:ability")
  ability(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId: string; actionId: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    client.emit("match:action-confirmed", {
      actionId: body.actionId,
      ability: "validated",
    });
  }

  @SubscribeMessage("match:surrender")
  surrender(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const match = this.multiplayer.surrender(body.matchId, client.playerId);
    if (match)
      this.server
        .to(body.matchId)
        .emit("match:finished", this.multiplayer.snapshot(match));
  }

  @SubscribeMessage("match:sync-request")
  sync(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { matchId: string },
  ) {
    const match = this.multiplayer.getMatch(body.matchId);
    if (match) client.emit("match:snapshot", this.multiplayer.snapshot(match));
  }

  @SubscribeMessage("match:reconnect")
  async reconnect(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { token: string },
  ) {
    if (!client.playerId) return this.authRequired(client);
    const match = await this.multiplayer.recoverMatch(body.token);
    if (
      !match ||
      !match.players.some((player) => player.playerId === client.playerId)
    ) {
      return client.emit("server:error", { code: "RECONNECT_EXPIRED" });
    }
    client.join(match.id);
    this.multiplayer.markSocket(client.playerId, client.id);
    client.emit("match:snapshot", this.multiplayer.snapshot(match));
  }

  @SubscribeMessage("player:ping")
  ping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { clientTime?: number },
  ) {
    client.emit("server:pong", {
      clientTime: body.clientTime,
      serverTime: Date.now(),
    });
  }

  private startMatchCountdown(matchId: string, roomName: string) {
    if (this.countdowns.has(matchId)) return;
    this.countdowns.add(matchId);
    const pending = this.multiplayer.getMatch(matchId);
    if (pending)
      this.server
        .to(roomName)
        .emit("matchmaking:found", this.multiplayer.snapshot(pending));
    [3, 2, 1].forEach((second) => {
      setTimeout(
        () =>
          this.server.to(roomName).emit("match:countdown", { matchId, second }),
        (3 - second) * 1000,
      );
    });
    setTimeout(() => {
      const match = this.multiplayer.markLoaded(matchId);
      if (match)
        this.server
          .to(roomName)
          .emit("match:started", this.multiplayer.snapshot(match));
      this.countdowns.delete(matchId);
    }, 3000);
  }

  private authRequired(client: Socket) {
    client.emit("server:error", {
      code: "AUTH_REQUIRED",
      message: "Authenticate the socket first.",
    });
  }
}
