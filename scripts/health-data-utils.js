const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function listJsonFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  const stack = [dirPath];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(fullPath);
      }
    }
  }

  return out.sort();
}

function normalizeChannel(value) {
  if (!value) return 'unknown';
  return String(value).trim().toLowerCase() || 'unknown';
}

function getUserId(user) {
  return user?.user_id || user?.sender_id || '';
}

function getUserIdentities(user) {
  const identities = Array.isArray(user?.identities)
    ? user.identities
        .filter(identity => identity && identity.sender_id)
        .map(identity => ({
          channel: normalizeChannel(identity.channel),
          sender_id: String(identity.sender_id),
        }))
    : [];

  if (identities.length) return identities;
  if (!user?.sender_id) return [];

  return [{
    channel: normalizeChannel(user.channel),
    sender_id: String(user.sender_id),
  }];
}

function getPrimaryIdentity(user) {
  return getUserIdentities(user)[0] || null;
}

function normalizeUserRecord(user) {
  const userId = getUserId(user);
  const identities = getUserIdentities(user);
  const primaryIdentity = identities[0] || null;
  return {
    ...user,
    user_id: userId,
    sender_id: user?.sender_id || primaryIdentity?.sender_id || '',
    channel: normalizeChannel(user?.channel || primaryIdentity?.channel),
    identities,
  };
}

function readUsers(healthRoot) {
  const usersData = readJson(path.join(healthRoot, 'users.json'), { users: [] });
  const users = Array.isArray(usersData?.users) ? usersData.users : [];
  return users.map(normalizeUserRecord);
}

function getUserDataDir(healthRoot, user) {
  return path.join(healthRoot, getUserId(user));
}

function identityMatches(identity, senderId, channel) {
  if (!identity || !senderId) return false;
  if (String(identity.sender_id) !== String(senderId)) return false;
  if (!channel) return true;

  const expectedChannel = normalizeChannel(channel);
  const actualChannel = normalizeChannel(identity.channel);
  return actualChannel === 'unknown' || actualChannel === expectedChannel;
}

function resolveUser(users, { userId = '', senderId = '', channel = '' } = {}) {
  if (userId) {
    return users.find(user => getUserId(user) === String(userId)) || null;
  }

  if (!senderId) return null;

  return users.find(user =>
    getUserIdentities(user).some(identity => identityMatches(identity, senderId, channel))
  ) || null;
}

function sortByDateTime(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return left.localeCompare(right);
}

function readDailyRecords(userDir, category, cutoffDate = '') {
  return listJsonFilesRecursive(path.join(userDir, category))
    .map(filePath => {
      const raw = readJson(filePath);
      if (!raw || !raw.date) return null;
      if (cutoffDate && raw.date < cutoffDate) return null;
      return {
        file: path.relative(path.join(userDir, category), filePath),
        path: filePath,
        ...raw,
      };
    })
    .filter(Boolean)
    .sort(sortByDateTime);
}

function buildDailyFilePath(baseDir, category, date) {
  const [year, month] = date.split('-');
  return path.join(baseDir, category, year, `${year}-${month}`, `${date}.json`);
}

module.exports = {
  buildDailyFilePath,
  getPrimaryIdentity,
  getUserDataDir,
  getUserId,
  getUserIdentities,
  normalizeChannel,
  normalizeUserRecord,
  listJsonFilesRecursive,
  readDailyRecords,
  readJson,
  readUsers,
  resolveUser,
  sortByDateTime,
};
