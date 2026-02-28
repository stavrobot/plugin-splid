#!/usr/bin/env node

const fs = require("fs");
const { SplidClient } = require("splid-js");

const KNOWN_PARAMS = new Set(["from", "to", "amount"]);

function findMember(members, name) {
  const lower = name.toLowerCase().trim();
  const match = members.find((m) => m.name.toLowerCase() === lower);
  if (!match) {
    const available = members.map((m) => m.name).join(", ");
    process.stderr.write(
      `Member "${name}" not found. Available members: ${available}`
    );
    process.exit(1);
  }
  return match;
}

async function main() {
  const input = fs.readFileSync(0, "utf-8");
  const params = JSON.parse(input);

  const unknown = Object.keys(params).filter((k) => !KNOWN_PARAMS.has(k));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown parameters: ${unknown.sort().join(", ")}`);
    process.exit(1);
  }

  if (!params.from) {
    process.stderr.write("Missing required parameter: from");
    process.exit(1);
  }
  if (!params.to) {
    process.stderr.write("Missing required parameter: to");
    process.exit(1);
  }
  if (params.amount === undefined || params.amount === null) {
    process.stderr.write("Missing required parameter: amount");
    process.exit(1);
  }
  if (typeof params.amount !== "number" || params.amount <= 0) {
    process.stderr.write("Parameter 'amount' must be a positive number");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("../config.json", "utf-8"));
  const inviteCode = config.invite_code;

  const splid = new SplidClient();

  const groupRes = await splid.group.getByInviteCode(inviteCode);
  const groupId = groupRes.result.objectId;

  const members = await splid.person.getAllByGroup(groupId);
  const activeMembers = members.filter((m) => !m.isDeleted);

  const sender = findMember(activeMembers, params.from);
  const recipient = findMember(activeMembers, params.to);

  await splid.entry.payment.create({
    groupId,
    payer: sender.GlobalId,
    profiteer: recipient.GlobalId,
    amount: params.amount,
  });

  const result = {
    message: `Payment of ${params.amount} from ${sender.name} to ${recipient.name} recorded.`,
    from: sender.name,
    to: recipient.name,
    amount: params.amount,
  };

  process.stdout.write(JSON.stringify(result));
}

main();
