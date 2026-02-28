#!/usr/bin/env node

const fs = require("fs");
const { SplidClient } = require("splid-js");

const KNOWN_PARAMS = new Set([]);

async function main() {
  const input = fs.readFileSync(0, "utf-8");
  const params = JSON.parse(input);

  const unknown = Object.keys(params).filter((k) => !KNOWN_PARAMS.has(k));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown parameters: ${unknown.sort().join(", ")}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("../config.json", "utf-8"));
  const inviteCode = config.invite_code;

  const splid = new SplidClient();

  const groupRes = await splid.group.getByInviteCode(inviteCode);
  const groupId = groupRes.result.objectId;

  const members = await splid.person.getAllByGroup(groupId);

  const activeMembers = members
    .filter((m) => !m.isDeleted)
    .map((m) => ({ name: m.name, id: m.GlobalId }));

  process.stdout.write(JSON.stringify({ members: activeMembers }));
}

main();
