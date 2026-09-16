import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface MatchHistoryItem {
  date: number;
  mode: string;
  map: string;
  won: boolean;
  kills: number;
  deaths: number;
  score: number;
}

export interface UserStats {
  grammarAnswered: number;
  grammarCorrect: number;
  ammoEarned: number;
  gamesPlayed: number;
  wins: number;
  kills: number;
  deaths: number;
  highestGrammarStreak: number;
  powerupsUsed: number;
  matchHistory: MatchHistoryItem[];
}

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number;
  stats: UserStats;
}

export type PublicUserProfile = Omit<UserRecord, 'salt' | 'passwordHash'>;

export class UserManager {
  private dataFilePath: string;
  private users: Map<string, UserRecord> = new Map(); // key: lowercase username
  private usersByEmail: Map<string, UserRecord> = new Map(); // key: lowercase email
  private usersById: Map<string, UserRecord> = new Map(); // key: id
  private sessionTokens: Map<string, string> = new Map(); // key: token, value: userId
  private secretKey: string;

  constructor(customDataDir?: string) {
    const dataDir = customDataDir || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('[UserManager] Could not create data dir:', err);
      }
    }
    this.dataFilePath = path.join(dataDir, 'users.json');
    this.secretKey = process.env.AUTH_SECRET || 'rivals_secret_salt_2026_x89';
    this.loadUsers();
  }

  private loadUsers(): void {
    if (!fs.existsSync(this.dataFilePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
      const list: UserRecord[] = JSON.parse(raw);
      for (const u of list) {
        if (!u.stats) {
          u.stats = {
            grammarAnswered: 0,
            grammarCorrect: 0,
            ammoEarned: 0,
            gamesPlayed: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            highestGrammarStreak: 0,
            powerupsUsed: 0,
            matchHistory: []
          };
        } else {
          u.stats.deaths = u.stats.deaths ?? 0;
          u.stats.highestGrammarStreak = u.stats.highestGrammarStreak ?? 0;
          u.stats.powerupsUsed = u.stats.powerupsUsed ?? 0;
          u.stats.matchHistory = u.stats.matchHistory ?? [];
        }
        this.users.set(u.username.toLowerCase(), u);
        if (u.email) {
          this.usersByEmail.set(u.email.toLowerCase(), u);
        }
        this.usersById.set(u.id, u);
      }
      console.log(`[UserManager] Loaded ${this.users.size} registered users.`);
    } catch (err) {
      console.error('[UserManager] Failed to read users.json:', err);
    }
  }

  private saveUsers(): void {
    try {
      const list = Array.from(this.usersById.values());
      fs.writeFileSync(this.dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[UserManager] Failed to save users.json:', err);
    }
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  private generateToken(userId: string): string {
    const payload = `${userId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const hmac = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64url')}.${hmac}`;
    this.sessionTokens.set(token, userId);
    return token;
  }

  public register(
    email: string,
    username: string,
    password: string
  ): { success: true; user: PublicUserProfile; token: string } | { success: false; error: string } {
    // 1. Mandatory @bbs.ac.th email validation
    const emailTrimmed = (email || '').trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@bbs\.ac\.th$/i;
    if (!emailTrimmed || !emailRegex.test(emailTrimmed)) {
      return {
        success: false,
        error: 'Registration is restricted to BBS school community. You must enter an email ending with @bbs.ac.th.'
      };
    }

    if (this.usersByEmail.has(emailTrimmed)) {
      return { success: false, error: 'An account with this @bbs.ac.th email already exists.' };
    }

    // 2. Username validation
    const trimmedUser = (username || emailTrimmed.split('@')[0]).trim();
    if (trimmedUser.length < 3 || trimmedUser.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters.' };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUser)) {
      return { success: false, error: 'Username can only contain letters, numbers, dots, hyphens, and underscores.' };
    }

    const lowerUserKey = trimmedUser.toLowerCase();
    if (this.users.has(lowerUserKey)) {
      return { success: false, error: 'Username is already taken.' };
    }

    // 3. Password validation
    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;

    const newRecord: UserRecord = {
      id: userId,
      email: emailTrimmed,
      username: trimmedUser,
      displayName: trimmedUser,
      salt,
      passwordHash,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      stats: {
        grammarAnswered: 0,
        grammarCorrect: 0,
        ammoEarned: 0,
        gamesPlayed: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        highestGrammarStreak: 0,
        powerupsUsed: 0,
        matchHistory: []
      }
    };

    this.users.set(lowerUserKey, newRecord);
    this.usersByEmail.set(emailTrimmed, newRecord);
    this.usersById.set(userId, newRecord);
    this.saveUsers();

    const token = this.generateToken(userId);
    return {
      success: true,
      user: this.toPublic(newRecord),
      token
    };
  }

  public login(
    identifier: string,
    password: string
  ): { success: true; user: PublicUserProfile; token: string } | { success: false; error: string } {
    const trimmedId = (identifier || '').trim().toLowerCase();
    // Allow login via email or username
    const record = this.usersByEmail.get(trimmedId) || this.users.get(trimmedId);
    if (!record) {
      return { success: false, error: 'Invalid @bbs.ac.th email/username or password.' };
    }

    const computed = this.hashPassword(password, record.salt);
    if (computed !== record.passwordHash) {
      return { success: false, error: 'Invalid @bbs.ac.th email/username or password.' };
    }

    record.lastLoginAt = Date.now();
    this.saveUsers();

    const token = this.generateToken(record.id);
    return {
      success: true,
      user: this.toPublic(record),
      token
    };
  }

  public getUserByToken(token: string): PublicUserProfile | null {
    if (!token) return null;
    const userId = this.sessionTokens.get(token);
    if (userId) {
      const u = this.usersById.get(userId);
      return u ? this.toPublic(u) : null;
    }

    // Attempt stateless verification if token has signature
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const payloadStr = Buffer.from(parts[0], 'base64url').toString('utf-8');
      const expectedHmac = crypto.createHmac('sha256', this.secretKey).update(payloadStr).digest('hex');
      if (expectedHmac !== parts[1]) return null;

      const [uid] = payloadStr.split(':');
      const u = this.usersById.get(uid);
      if (u) {
        this.sessionTokens.set(token, uid);
        return this.toPublic(u);
      }
    } catch {
      return null;
    }

    return null;
  }

  public recordGrammarStat(
    userId: string,
    questionsAnswered: number,
    correctCount: number,
    ammoAwarded: number,
    currentStreak: number = 0
  ): PublicUserProfile | null {
    const u = this.usersById.get(userId);
    if (!u) return null;

    u.stats.grammarAnswered += Math.max(0, questionsAnswered);
    u.stats.grammarCorrect += Math.max(0, correctCount);
    u.stats.ammoEarned += Math.max(0, ammoAwarded);
    if (currentStreak > (u.stats.highestGrammarStreak || 0)) {
      u.stats.highestGrammarStreak = currentStreak;
    }
    this.saveUsers();

    return this.toPublic(u);
  }

  public recordMatchResult(userId: string, won: boolean, kills: number): PublicUserProfile | null {
    return this.recordDetailedMatchResult(userId, won, kills, 0, '1v1', 'Cartoon City', kills);
  }

  public recordDetailedMatchResult(
    userId: string,
    won: boolean,
    kills: number,
    deaths: number,
    mode: string = '1v1',
    mapName: string = 'Cartoon City',
    score: number = 0
  ): PublicUserProfile | null {
    const u = this.usersById.get(userId);
    if (!u) return null;

    u.stats.gamesPlayed += 1;
    if (won) u.stats.wins += 1;
    u.stats.kills += Math.max(0, kills);
    u.stats.deaths = (u.stats.deaths || 0) + Math.max(0, deaths);

    if (!u.stats.matchHistory) u.stats.matchHistory = [];
    u.stats.matchHistory.unshift({
      date: Date.now(),
      mode,
      map: mapName,
      won,
      kills,
      deaths,
      score
    });

    if (u.stats.matchHistory.length > 15) {
      u.stats.matchHistory = u.stats.matchHistory.slice(0, 15);
    }

    this.saveUsers();
    return this.toPublic(u);
  }

  public recordPowerupUsage(userId: string, count: number = 1): PublicUserProfile | null {
    const u = this.usersById.get(userId);
    if (!u) return null;
    u.stats.powerupsUsed = (u.stats.powerupsUsed || 0) + count;
    this.saveUsers();
    return this.toPublic(u);
  }

  private toPublic(record: UserRecord): PublicUserProfile {
    return {
      id: record.id,
      email: record.email,
      username: record.username,
      displayName: record.displayName,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
      stats: { ...record.stats }
    };
  }
}
