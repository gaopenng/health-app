#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const {
  getUserDataDir,
  getUserId,
  normalizeChannel,
  normalizeUserRecord,
  readJson,
} = require('./health-data-utils');

const args = process.argv.slice(2);
const defaultHealthDir = path.join(os.homedir(), '.health');

function getArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function hasArg(name) {
  return args.includes(name);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function dedupeIdentities(user) {
  const bySender = new Map();
  const push = (channel, senderId) => {
    if (!senderId) return;
    const normalizedChannel = normalizeChannel(channel);
    const key = String(senderId);
    const current = bySender.get(key) || [];
    if (!current.includes(normalizedChannel)) {
      current.push(normalizedChannel);
      bySender.set(key, current);
    }
  };

  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      push(identity?.channel, identity?.sender_id);
    }
  }

  push(user.channel, user.sender_id);

  const identities = [];
  for (const [senderId, channels] of bySender.entries()) {
    const explicitChannels = channels.filter(channel => channel !== 'unknown');
    const finalChannels = explicitChannels.length ? explicitChannels : channels;
    for (const channel of finalChannels) {
      identities.push({ channel, sender_id: senderId });
    }
  }

  return identities;
}

if (hasArg('--help')) {
  console.log('Usage: node agent/skills/user-manager/scripts/migrate-user-to-uuid.js --current-user-id OLD_ID --username USERNAME [--new-user-id UUID] [--name DISPLAY_NAME] [--health-data-dir DIR]');
  process.exit(0);
}

const healthDataDir = path.resolve(getArg('--health-data-dir', defaultHealthDir));
const currentUserId = getArg('--current-user-id');
const username = getArg('--username');
const nextUserId = getArg('--new-user-id') || randomUUID();
const displayName = getArg('--name');

if (!currentUserId || !username) {
  fail('Missing required args: --current-user-id and --username');
}

if (!isUuid(nextUserId)) {
  fail(`new user id must be UUID v4: ${nextUserId}`);
}

const usersFile = path.join(healthDataDir, 'users.json');
const usersData = readJson(usersFile, { users: [] });
if (!Array.isArray(usersData.users)) {
  fail(`Invalid users file: ${usersFile}`);
}

const normalizedUsers = usersData.users.map(normalizeUserRecord);
const targetIndex = normalizedUsers.findIndex(user => getUserId(user) === currentUserId);
if (targetIndex === -1) {
  fail(`User not found: ${currentUserId}`);
}

const usernameConflict = normalizedUsers.find((user, index) =>
  index !== targetIndex && String(user.username || '').toLowerCase() === username.toLowerCase()
);
if (usernameConflict) {
  fail(`Username already exists: ${username}`);
}

const idConflict = normalizedUsers.find((user, index) =>
  index !== targetIndex && getUserId(user) === nextUserId
);
if (idConflict) {
  fail(`Target UUID already exists: ${nextUserId}`);
}

const rawUser = usersData.users[targetIndex];
const normalizedUser = normalizeUserRecord(rawUser);
const previousDir = getUserDataDir(healthDataDir, normalizedUser);
const nextDir = path.join(healthDataDir, nextUserId);
const backupUsersFile = `${usersFile}.bak-migrate-${Date.now()}`;

rawUser.user_id = nextUserId;
rawUser.username = username;
rawUser.name = displayName || rawUser.name || username;
rawUser.identities = dedupeIdentities(normalizedUser);

if (!Array.isArray(rawUser.identities) || !rawUser.identities.length) {
  fail('User has no identities to preserve');
}

rawUser.channel = rawUser.identities[0].channel;
rawUser.sender_id = rawUser.identities[0].sender_id;

fs.copyFileSync(usersFile, backupUsersFile);

if (previousDir !== nextDir && fs.existsSync(previousDir)) {
  if (fs.existsSync(nextDir)) {
    fail(`Target data directory already exists: ${nextDir}`);
  }
  fs.renameSync(previousDir, nextDir);
}

writeJson(usersFile, usersData);

console.log(JSON.stringify({
  previous_user_id: currentUserId,
  new_user_id: nextUserId,
  username,
  backup_users_file: backupUsersFile,
  data_dir: nextDir,
  identities: rawUser.identities,
}, null, 2));
