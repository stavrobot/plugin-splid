#!/usr/bin/env node

const fs = require("fs");
const { SplidClient } = require("splid-js");

const KNOWN_PARAMS = new Set([]);

async function main() {
  const input = fs.readFileSync("/dev/stdin", "utf-8");
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

  const [groupInfo, members, entries] = await Promise.all([
    splid.groupInfo.getOneByGroup(groupId),
    splid.person.getAllByGroup(groupId),
    splid.entry.getAllByGroup(groupId),
  ]);

  const activeMembers = members.filter((m) => !m.isDeleted);
  const memberLookup = Object.fromEntries(
    activeMembers.map((m) => [m.GlobalId, m.name])
  );

  const balance = SplidClient.getBalance(activeMembers, entries, groupInfo);
  const suggestedPayments = SplidClient.getSuggestedPayments(balance);

  const memberBalances = Object.entries(balance).map(
    ([globalId, balanceItem]) => ({
      name: memberLookup[globalId] || globalId,
      balance: balanceItem.balance,
      total_paid: balanceItem.payedBy,
      total_owed: balanceItem.payedFor,
    })
  );

  const payments = suggestedPayments.map((p) => ({
    from: memberLookup[p.from] || p.from,
    to: memberLookup[p.to] || p.to,
    amount: p.amount,
  }));

  const result = {
    group_name: groupInfo.name,
    currency: groupInfo.defaultCurrencyCode,
    member_balances: memberBalances,
    suggested_payments: payments,
  };

  process.stdout.write(JSON.stringify(result));
}

main();
