import { UserManager } from '../src/server/auth/UserManager.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Running User Auth & BBS School Email Tests...');

const testDataDir = path.resolve(process.cwd(), 'data_test_bbs');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

const userManager = new UserManager(testDataDir);

// 1. Rejection of non-bbs.ac.th emails
const badEmailRes = userManager.register('student@gmail.com', 'Alex', 'laser99');
if (badEmailRes.success) {
  console.error('❌ Registration with non-bbs email should be rejected');
  process.exit(1);
}
console.log('✓ Rejected non-bbs email (@gmail.com):', badEmailRes.error);

// 2. Successful registration with @bbs.ac.th
const regRes = userManager.register('student101@bbs.ac.th', 'RivalPilot', 'laser99');
if (!regRes.success) {
  console.error('❌ Registration failed for valid bbs email:', regRes);
  process.exit(1);
}
console.log('✓ Registered valid BBS user:', regRes.user.email, regRes.user.username);

// 3. Duplicate email registration check
const dupEmailRes = userManager.register('student101@bbs.ac.th', 'DifferentName', 'laser99');
if (dupEmailRes.success) {
  console.error('❌ Duplicate email registration should fail');
  process.exit(1);
}
console.log('✓ Duplicate BBS email rejected correctly');

// 4. Test Login via Email
const loginEmailRes = userManager.login('student101@bbs.ac.th', 'laser99');
if (!loginEmailRes.success) {
  console.error('❌ Login via email failed');
  process.exit(1);
}
console.log('✓ Login via BBS email succeeded');

// 5. Test Login via Username
const loginUserRes = userManager.login('RivalPilot', 'laser99');
if (!loginUserRes.success) {
  console.error('❌ Login via username failed');
  process.exit(1);
}
console.log('✓ Login via username succeeded');

// 6. Test Grammar Stat Tracking
const updatedUser = userManager.recordGrammarStat(regRes.user.id, 2, 2, 60);
if (!updatedUser || updatedUser.stats.grammarAnswered !== 2 || updatedUser.stats.ammoEarned !== 60) {
  console.error('❌ Grammar stats update failed:', updatedUser);
  process.exit(1);
}
console.log('✓ Grammar stat successfully updated (+2 questions, +60 ammo)');

// 7. Test Match History Recording and Deletion
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

// Clear all match records
const uAfterClear = userManager.clearMatchHistory(regRes.user.id);
if (!uAfterClear || uAfterClear.stats.matchHistory.length !== 0 || uAfterClear.stats.gamesPlayed !== 0) {
  console.error('❌ Clear match history failed:', uAfterClear);
  process.exit(1);
}
console.log('✓ All match records purged successfully');

// Clean up test directory
fs.rmSync(testDataDir, { recursive: true, force: true });

console.log('🎉 ALL BBS AUTH & PROFILE TESTS PASSED CLEANLY!\n');
