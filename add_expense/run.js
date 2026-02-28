#!/usr/bin/env node

const fs = require("fs");
const { SplidClient } = require("splid-js");

const KNOWN_PARAMS = new Set(["title", "amount", "payer", "profiteers"]);

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
  const input = fs.readFileSync("/dev/stdin", "utf-8");
  const params = JSON.parse(input);

  const unknown = Object.keys(params).filter((k) => !KNOWN_PARAMS.has(k));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown parameters: ${unknown.sort().join(", ")}`);
    process.exit(1);
  }

  if (!params.title) {
    process.stderr.write("Missing required parameter: title");
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
  if (!params.payer) {
    process.stderr.write("Missing required parameter: payer");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync("../config.json", "utf-8"));
  const inviteCode = config.invite_code;

  const splid = new SplidClient();

  const groupRes = await splid.group.getByInviteCode(inviteCode);
  const groupId = groupRes.result.objectId;

  const members = await splid.person.getAllByGroup(groupId);
  const activeMembers = members.filter((m) => !m.isDeleted);

  const payer = findMember(activeMembers, params.payer);

  let profiteerIds;
  if (params.profiteers) {
    const names = params.profiteers.split(",").map((n) => n.trim());
    profiteerIds = names.map((n) => findMember(activeMembers, n).GlobalId);
  } else {
    profiteerIds = activeMembers.map((m) => m.GlobalId);
  }

  await splid.entry.expense.create(
    {
      groupId,
      payers: [payer.GlobalId],
      title: params.title,
    },
    {
      amount: params.amount,
      profiteers: profiteerIds,
    }
  );

  const result = {
    message: `Expense "${params.title}" for ${params.amount} added successfully.`,
    payer: payer.name,
    split_between: profiteerIds.length + " members",
  };

  process.stdout.write(JSON.stringify(result));
}

main();
