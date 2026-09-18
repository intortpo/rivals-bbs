import crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import { GameSession } from './GameSession.js';
import { GameMode, OpenRoomSummary, RoomNetworkState, TeamColor, CharacterCustomization } from '../shared/types.js';
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
    fragLimit?: number,
    mapName: string = 'Cyber Spire',
    outfitIndex: number = 0,
    customization?: CharacterCustomization,
    forceRoomId?: string
    
  ): { roomId: string; session: GameSession; hostSecret: string } {
    const roomId = forceRoomId || this.generateRoomId();
    const color = PLAYER_COLORS[0];
    const defaultFrag = mode === '4v4' ? 20 : mode === 'wave' ? (fragLimit || 10) : (fragLimit || NETWORK.DEFAULT_FRAG_LIMIT);

    const initialRoomState: RoomNetworkState = {
      roomId,
      hostId: hostSocket.id,
      mode,
      mapName,
      fragLimit: defaultFrag,
      status: 'lobby',
      countdown: NETWORK.COUNTDOWN_SECONDS,
      players: {},
      teamScores: mode === '4v4' ? { blue: 0, red: 0 } : undefined
    };

    const hostSecret = crypto.randomBytes(16).toString('hex');
    const session = new GameSession(
      this.io,
      initialRoomState,
      () => this.broadcastOpenRooms(),
      hostSecret,
      playerName || 'Host Rival'
    );
    const hostTeam: TeamColor = (mode === '4v4' || mode === 'wave') ? 'blue' : 'none';
    session.addPlayer(hostSocket.id, playerName || 'Host Rival', color, true, hostTeam, outfitIndex, customization);

    this.rooms.set(roomId, session);
    this.socketToRoom.set(hostSocket.id, roomId);
    hostSocket.join(roomId);

    this.broadcastOpenRooms();
    return { roomId, session, hostSecret };
  }

  public joinRoom(
    socket: Socket,
    roomId: string,
    playerName: string,
    outfitIndex: number = 0,
    customization?: CharacterCustomization,
    
  ): { success: boolean; error?: string; session?: GameSession } {
    const session = this.rooms.get(roomId.toUpperCase());
    if (!session) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    if (session.roomState.status === 'game_over') {
      return { success: false, error: 'This match has already ended.' };
    }

    const currentCount = Object.values(session.roomState.players).filter(p => !p.isBot).length;
    const maxPlayers = session.roomState.mode === '1v1' ? 2 : session.roomState.mode === 'wave' ? 4 : 8;

    if (currentCount >= maxPlayers) {
      return { success: false, error: 'Room is full.' };
    }

    let assignedTeam: TeamColor = 'none';
    if (session.roomState.mode === '4v4') {
      let blueCount = 0;
      let redCount = 0;
      for (const p of Object.values(session.roomState.players)) {
        if (!p.isBot) {
          if (p.team === 'blue') blueCount++;
          else if (p.team === 'red') redCount++;
        }
      }
      assignedTeam = blueCount <= redCount ? 'blue' : 'red';
    } else if (session.roomState.mode === 'wave') {
      assignedTeam = 'blue';
    }

    const color = PLAYER_COLORS[currentCount % PLAYER_COLORS.length];
    session.addPlayer(socket.id, playerName || `Rival #${currentCount + 1}`, color, false, assignedTeam, outfitIndex, customization);

    this.socketToRoom.set(socket.id, session.roomId);
    socket.join(session.roomId);

    session.broadcastRoomState();
    this.broadcastOpenRooms();

    // If game is already in progress, notify this joining client immediately to enter the arena
    if (session.roomState.status === 'playing') {
      socket.emit('game_start');
    }

    return { success: true, session };
  }

  public deleteRoom(
    roomId: string,
    requesterSocketId: string,
    hostSecret?: string
  ): { success: boolean; error?: string } {
    const normRoomId = (roomId || '').trim().toUpperCase();
    const session = this.rooms.get(normRoomId);
    if (!session) {
      return { success: false, error: 'Room not found.' };
    }

    // Verify ownership: socket is current hostId OR hostSecret matches
    const isHostSocket = session.roomState.hostId === requesterSocketId;
    const isSecretMatch = Boolean(hostSecret && session.hostSecret && session.hostSecret === hostSecret);

    if (!isHostSocket && !isSecretMatch) {
      return { success: false, error: 'Unauthorized: Only the game host can delete this room.' };
    }

    console.log(`[RoomManager] Room ${normRoomId} deleted by host (socket: ${requesterSocketId}, secretMatch: ${isSecretMatch})`);

    // Notify all players in room
    this.io.to(normRoomId).emit('room_deleted', {
      roomId: normRoomId,
      reason: 'The game host cancelled and deleted this room.'
    });

    // Make all sockets leave this socket.io room and clear mappings
    for (const [sockId, rId] of this.socketToRoom.entries()) {
      if (rId === normRoomId) {
        this.socketToRoom.delete(sockId);
        const s = this.io.sockets.sockets?.get(sockId);
        s?.leave(normRoomId);
      }
    }

    session.stop();
    this.rooms.delete(normRoomId);
    this.broadcastOpenRooms();

    return { success: true };
  }

  public leaveRoom(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    this.socketToRoom.delete(socket.id);
    socket.leave(roomId);

    const session = this.rooms.get(roomId);
    if (!session) return;

    const wasHost = session.roomState.hostId === socket.id;
    session.removePlayer(socket.id);

    // Filter out bots to check if any real human players remain
    const remainingHumans = Object.values(session.roomState.players).filter(p => !p.isBot);

    if (remainingHumans.length === 0 || session.roomState.status === 'game_over') {
      session.stop();
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Room ${roomId} cleaned up. Active rooms: ${this.rooms.size}`);
    } else if (wasHost && session.roomState.status === 'lobby') {
      const nextHost = remainingHumans[0];
      session.roomState.hostId = nextHost.id;
      nextHost.isHost = true;
      session.broadcastRoomState();
      console.log(`[RoomManager] Host migrated in room ${roomId} to ${nextHost.name} (${nextHost.id})`);
    }

    this.broadcastOpenRooms();
  }

  public handleDisconnect(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    this.socketToRoom.delete(socket.id);
    const session = this.rooms.get(roomId);
    if (!session) return;

    const wasHost = session.roomState.hostId === socket.id;
    session.removePlayer(socket.id);

    // Filter out bots to check if any real human players remain
    const remainingHumans = Object.values(session.roomState.players).filter(p => !p.isBot);

    if (remainingHumans.length === 0 || session.roomState.status === 'game_over') {
      session.stop();
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Room ${roomId} closed (empty/finished). Active rooms: ${this.rooms.size}`);
    } else if (wasHost && session.roomState.status === 'lobby') {
      const nextHost = remainingHumans[0];
      session.roomState.hostId = nextHost.id;
      nextHost.isHost = true;
      session.broadcastRoomState();
      console.log(`[RoomManager] Host migrated on disconnect in room ${roomId} to ${nextHost.name}`);
    }

    this.broadcastOpenRooms();
  }

  public getOpenRoomsList(): OpenRoomSummary[] {
    const list: OpenRoomSummary[] = [];
    for (const session of this.rooms.values()) {
      const state = session.roomState;

      // Filter out ended games immediately
      if (state.status === 'game_over') {
        continue;
      }

      const count = Object.values(state.players).filter(p => !p.isBot).length;
      const max = state.mode === '1v1' ? 2 : state.mode === 'wave' ? 4 : 8;

      // Filter out full games with no open slots
      if (count >= max) {
        continue;
      }

      const host = state.players[state.hostId]?.name || 'Host';

      list.push({
        roomId: state.roomId,
        mode: state.mode,
        mapName: state.mapName,
        fragLimit: state.fragLimit,
        playerCount: count,
        maxPlayers: max,
        hostName: host,
        status: state.status
      });
    }
    return list;
  }

  public broadcastOpenRooms(): void {
    const list = this.getOpenRoomsList();
    this.io.emit('open_rooms_update', list);
    this.io.emit('open_rooms_list', list);
  }

  public getSession(roomId: string): GameSession | undefined {
    return this.rooms.get(roomId);
  }

  public getSessionBySocketId(socketId: string): GameSession | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }
}

