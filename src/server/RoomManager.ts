import { Server, Socket } from 'socket.io';
import { GameSession } from './GameSession.js';
import { GameMode, RoomNetworkState } from '../shared/types.js';
import { NETWORK, PLAYER_COLORS } from '../shared/constants.js';

export class RoomManager {
  private io: Server;
  private rooms: Map<string, GameSession> = new Map();
  private socketToRoom: Map<string, string> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const id = `RV-${code}`;
    return this.rooms.has(id) ? this.generateRoomId() : id;
  }

  public createRoom(
    hostSocket: Socket,
    playerName: string,
    mode: GameMode = '1v1',
    fragLimit: number = NETWORK.DEFAULT_FRAG_LIMIT,
    mapName: string = 'Arena Classic'
  ): { roomId: string; session: GameSession } {
    const roomId = this.generateRoomId();
    const color = PLAYER_COLORS[0];

    const initialRoomState: RoomNetworkState = {
      roomId,
      hostId: hostSocket.id,
      mode,
      mapName,
      fragLimit,
      status: 'lobby',
      countdown: NETWORK.COUNTDOWN_SECONDS,
      players: {}
    };

    const session = new GameSession(this.io, initialRoomState);
    session.addPlayer(hostSocket.id, playerName || 'Host Rival', color, true);

    this.rooms.set(roomId, session);
    this.socketToRoom.set(hostSocket.id, roomId);
    hostSocket.join(roomId);

    return { roomId, session };
  }

  public joinRoom(
    socket: Socket,
    roomId: string,
    playerName: string
  ): { success: boolean; error?: string; session?: GameSession } {
    const session = this.rooms.get(roomId.toUpperCase());
    if (!session) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    const currentCount = Object.keys(session.roomState.players).length;
    const maxPlayers = session.roomState.mode === '1v1' ? 2 : 8;

    if (currentCount >= maxPlayers) {
      return { success: false, error: 'Room is full.' };
    }

    const color = PLAYER_COLORS[currentCount % PLAYER_COLORS.length];
    session.addPlayer(socket.id, playerName || `Rival #${currentCount + 1}`, color, false);

    this.socketToRoom.set(socket.id, session.roomId);
    socket.join(session.roomId);

    session.broadcastRoomState();

    return { success: true, session };
  }

  public handleDisconnect(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    this.socketToRoom.delete(socket.id);
    const session = this.rooms.get(roomId);
    if (!session) return;

    session.removePlayer(socket.id);

    // If no players remain, clean up room
    if (Object.keys(session.roomState.players).length === 0) {
      session.stop();
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Room ${roomId} closed (empty). Active rooms: ${this.rooms.size}`);
    }
  }

  public getSession(roomId: string): GameSession | undefined {
    return this.rooms.get(roomId);
  }

  public getSessionBySocketId(socketId: string): GameSession | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }
}
