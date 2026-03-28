#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getUserId,
  normalizeChannel,
  normalizeUserRecord,
  readJson,
  resolveUser,
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

if (hasArg('--help')) {
  console.log('Usage: node scripts/link-user-identity.js --user-id USER_ID --channel CHANNEL --sender-id SENDER_ID [--health-data-dir DIR]');
  process.exit(0);
}

const healthDataDir = path.resolve(getArg('--health-data-dir', defaultHealthDir));
const userId = getArg('--user-id');
const senderId = getArg('--sender-id');
const channel = normalizeChannel(getArg('--channel'));

if (!userId || !senderId || !channel) {
  fail('Missing required args: --user-id, --channel, --sender-id');
}

const usersFile = path.join(healthDataDir, 'users.json');
const usersData = readJson(usersFile, { users: [] });
if (!Array.isArray(usersData.users)) {
  fail(`Invalid users file: ${usersFile}`);
}

const normalizedUsers = usersData.users.map(normalizeUserRecord);
const targetUser = resolveUser(normalizedUsers, { userId });
if (!targetUser) {
  fail(`User not found: ${userId}`);
}

const conflictUser = resolveUser(normalizedUsers, { senderId, channel });
if (conflictUser && getUserId(conflictUser) !== userId) {
  fail(`Identity already belongs to another user: ${getUserId(conflictUser)}`);
}

const targetIndex = usersData.users.findIndex(rawUser => getUserId(normalizeUserRecord(rawUser)) === userId);
if (targetIndex === -1) {
  fail(`Failed to locate raw user record: ${userId}`);
}

const rawTarget = usersData.users[targetIndex];
const normalizedTarget = normalizeUserRecord(rawTarget);
const identities = [...normalizedTarget.identities];
const alreadyExists = identities.some(identity =>
  identity.channel === channel && String(identity.sender_id) === String(senderId)
);

if (!alreadyExists) {
  identities.push({ channel, sender_id: String(senderId) });
}

rawTarget.user_id = userId;
rawTarget.identities = identities;

if (!rawTarget.sender_id) {
  rawTarget.sender_id = String(senderId);
}
if (!rawTarget.channel) {
  rawTarget.channel = channel;
}

writeJson(usersFile, usersData);

console.log(alreadyExists
  ? `identity already linked: ${channel}:${senderId} -> ${userId}`
  : `linked identity ${channel}:${senderId} -> ${userId}`);
