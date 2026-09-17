import { UserManager } from '../src/server/auth/UserManager.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Running Auth E2E & Match Stats Token Verification Tests...');

const testDataDir = path.resolve(process.cwd(), 'data_test_auth_e2e');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

const userManager = new UserManager(testDataDir);

// 1. Register a test player
const reg = userManager.register('RivalKing', 'battlePass2026');
if (!reg.success) {
  console.error('❌ Failed to register RivalKing:', reg);
  process.exit(1);
}
console.log('✓ Registered user:', reg.user.username, `(id: ${reg.user.id})`);

// 2. Verify token validity
const token = reg.token;
const userFromToken = userManager.getUserByToken(token);
if (!userFromToken || userFromToken.id !== reg.user.id) {
  console.error('❌ Failed to authenticate valid token:', token);
  process.exit(1);
}
console.log('✓ Validated session token for user:', userFromToken.username);

// 3. Record Match Result with authenticated user ID
const matchRes = userManager.recordDetailedMatchResult(
  userFromToken.id,
  true,
  7,
  2,
  '1v1',
  'Arena Classic',
  1400
);

if (!matchRes || matchRes.stats.gamesPlayed !== 1 || matchRes.stats.wins !== 1 || matchRes.stats.kills !== 7) {
  console.error('❌ Match result recording failed:', matchRes);
  process.exit(1);
}
console.log('✓ Match result successfully recorded: 1 Win, 7 Kills, 2 Deaths');

// 4. Record Grammar drill stat
const grammarRes = userManager.recordGrammarStat(userFromToken.id, 2, 2, 60, 5);
if (!grammarRes || grammarRes.stats.grammarAnswered !== 2 || grammarRes.stats.ammoEarned !== 60) {
  console.error('❌ Grammar stat recording failed:', grammarRes);
  process.exit(1);
}
console.log('✓ Grammar stat successfully recorded: 2 solved, +60 ammo, streak 5');

// 5. Test invalid token rejection
const badUser = userManager.getUserByToken('invalid.token.string');
if (badUser !== null) {
  console.error('❌ Invalid token should return null');
  process.exit(1);
}
console.log('✓ Invalid token properly rejected with null');

// Clean up
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

console.log('🎉 ALL AUTH E2E & STATS RECORDING TESTS PASSED CLEANLY!');
