import { UserManager } from '../src/server/auth/UserManager.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Running Username & Password Auth and Persistence Tests...');

const testDataDir = path.resolve(process.cwd(), 'data_test_auth');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

let userManager = new UserManager(testDataDir);

// 1. Rejection of invalid usernames
const shortUserRes = userManager.register('al', 'laser99');
if (shortUserRes.success) {
  console.error('❌ Registration with short username (< 3 chars) should be rejected');
  process.exit(1);
}
console.log('✓ Rejected short username (< 3 chars):', shortUserRes.error);

const invalidCharsUserRes = userManager.register('pilot@strike#1', 'laser99');
if (invalidCharsUserRes.success) {
  console.error('❌ Registration with invalid characters should be rejected');
  process.exit(1);
}
console.log('✓ Rejected username with invalid characters:', invalidCharsUserRes.error);

// 2. Rejection of short passwords (< 4 chars)
const shortPassRes = userManager.register('ValidUser', '123');
if (shortPassRes.success) {
  console.error('❌ Registration with short password (< 4 chars) should be rejected');
  process.exit(1);
}
console.log('✓ Rejected short password (< 4 chars):', shortPassRes.error);

// 3. Successful registration with ONLY username and password (no email)
const regRes = userManager.register('CyberAce_99', 'securePass123');
if (!regRes.success) {
  console.error('❌ Registration failed for valid username/password:', regRes);
  process.exit(1);
}
console.log('✓ Registered valid user with username & password only:', regRes.user.username, `(id: ${regRes.user.id})`);
if (regRes.user.email) {
  console.error('❌ Registered user should not have an email');
  process.exit(1);
}

// 4. Case-insensitive duplicate username check
const dupUserRes = userManager.register('cyberace_99', 'anotherPass');
if (dupUserRes.success) {
  console.error('❌ Duplicate username registration should fail');
  process.exit(1);
}
console.log('✓ Duplicate username (case-insensitive) rejected correctly:', dupUserRes.error);

// 5. Successful login with username and password
const loginRes = userManager.login('CyberAce_99', 'securePass123');
if (!loginRes.success) {
  console.error('❌ Login with valid username and password failed');
  process.exit(1);
}
console.log('✓ Login with valid credentials succeeded, received session token');

// 6. Case-insensitive login
const loginLowerRes = userManager.login('cyberace_99', 'securePass123');
if (!loginLowerRes.success) {
  console.error('❌ Case-insensitive login failed');
  process.exit(1);
}
console.log('✓ Case-insensitive username login succeeded');

// 7. Incorrect password rejection
const badPassRes = userManager.login('CyberAce_99', 'wrongPassword');
if (badPassRes.success) {
  console.error('❌ Login with wrong password should fail');
  process.exit(1);
}
console.log('✓ Login with incorrect password rejected correctly');

// 8. Non-existent user login rejection
const unknownUserRes = userManager.login('NonExistentPilot', 'somePass');
if (unknownUserRes.success) {
  console.error('❌ Login with non-existent username should fail');
  process.exit(1);
}
console.log('✓ Login with non-existent username rejected correctly');

// 9. Session token validation (getUserByToken)
const userFromToken = userManager.getUserByToken(loginRes.token);
if (!userFromToken || userFromToken.username !== 'CyberAce_99') {
  console.error('❌ getUserByToken failed to retrieve correct user profile');
  process.exit(1);
}
console.log('✓ Session token successfully verified user identity:', userFromToken.username);

// 10. Test Grammar Stat Tracking
const updatedUser = userManager.recordGrammarStat(regRes.user.id, 2, 2, 60, 3);
if (!updatedUser || updatedUser.stats.grammarAnswered !== 2 || updatedUser.stats.ammoEarned !== 60 || updatedUser.stats.highestGrammarStreak !== 3) {
  console.error('❌ Grammar stats update failed:', updatedUser);
  process.exit(1);
}
console.log('✓ Grammar stat successfully updated (+2 questions, +60 ammo, streak 3)');

// 11. Test Match History Recording and Deletion
userManager.recordDetailedMatchResult(regRes.user.id, true, 5, 2, '1v1', 'Cartoon City', 5);
userManager.recordDetailedMatchResult(regRes.user.id, false, 2, 4, '4v4', 'Quantum Lab', 2);
const uAfterMatches = userManager.recordDetailedMatchResult(regRes.user.id, true, 8, 1, 'wave', 'Cyber Spire', 8);

if (!uAfterMatches || uAfterMatches.stats.matchHistory.length !== 3 || uAfterMatches.stats.gamesPlayed !== 3) {
  console.error('❌ Match history recording failed:', uAfterMatches);
  process.exit(1);
}
console.log('✓ 3 Match results recorded to career history');

// Delete 1 match record by index
const uAfterDelete1 = userManager.deleteMatchHistoryEntry(regRes.user.id, 1);
if (!uAfterDelete1 || uAfterDelete1.stats.matchHistory.length !== 2 || uAfterDelete1.stats.gamesPlayed !== 2) {
  console.error('❌ Deleting match entry failed:', uAfterDelete1);
  process.exit(1);
}
console.log('✓ Single match record deleted successfully (remaining: 2)');

// 12. Verify Disk Persistence across new UserManager instance
const usersFile = path.join(testDataDir, 'users.json');
if (!fs.existsSync(usersFile)) {
  console.error('❌ users.json file does not exist on disk');
  process.exit(1);
}
const rawUsers = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
if (!Array.isArray(rawUsers) || rawUsers.length !== 1 || rawUsers[0].username !== 'CyberAce_99') {
  console.error('❌ users.json content is invalid:', rawUsers);
  process.exit(1);
}
console.log('✓ Verified users.json was saved to disk with expected user record');

// Instantiate a fresh UserManager to simulate server restart
const freshUserManager = new UserManager(testDataDir);
const reloadedLogin = freshUserManager.login('CyberAce_99', 'securePass123');
if (!reloadedLogin.success) {
  console.error('❌ Login failed after reloading UserManager from users.json');
  process.exit(1);
}
if (reloadedLogin.user.stats.grammarAnswered !== 2 || reloadedLogin.user.stats.gamesPlayed !== 2) {
  console.error('❌ Reloaded user stats do not match persisted data:', reloadedLogin.user.stats);
  process.exit(1);
}
console.log('✓ Fresh UserManager instance successfully loaded persisted user and stats from disk');

// Clean up test directory
fs.rmSync(testDataDir, { recursive: true, force: true });

console.log('🎉 ALL USERNAME/PASSWORD AUTH & PERSISTENCE TESTS PASSED CLEANLY!\n');
