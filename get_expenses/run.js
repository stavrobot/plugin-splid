#!/usr/bin/env node

const fs = require("fs");
const { SplidClient } = require("splid-js");

const KNOWN_PARAMS = new Set(["limit"]);

async function main() {
  const input = fs.readFileSync("/dev/stdin", "utf-8");
  const params = JSON.parse(input);

  const unknown = Object.keys(params).filter((k) => !KNOWN_PARAMS.has(k));
  if (unknown.length > 0) {
    process.stderr.write(`Unknown parameters: ${unknown.sort().join(", ")}`);
    process.exit(1);
  }

  const limit = params.limit || 20;

  const config = JSON.parse(fs.readFileSync("../config.json", "utf-8"));
  const inviteCode = config.invite_code;

  const splid = new SplidClient();

  const groupRes = await splid.group.getByInviteCode(inviteCode);
  const groupId = groupRes.result.objectId;

  const [members, entries] = await Promise.all([
    splid.person.getAllByGroup(groupId),
    splid.entry.getAllByGroup(groupId),
  ]);

  const memberLookup = Object.fromEntries(
    members.map((m) => [m.GlobalId, m.name])
  );

  const activeEntries = entries
    .filter((e) => !e.isDeleted)
    .sort(
      (a, b) =>
        new Date(b.createdGlobally.iso).getTime() -
        new Date(a.createdGlobally.iso).getTime()
    )
    .slice(0, limit);

  const result = activeEntries.map((entry) => {
    const payer = memberLookup[entry.primaryPayer] || entry.primaryPayer;

    const totalAmount = entry.items.reduce((sum, item) => sum + item.AM, 0);

    const profiteers = [];
    for (const item of entry.items) {
      for (const [userId, share] of Object.entries(item.P.P)) {
        const name = memberLookup[userId] || userId;
        const amount = Math.round(item.AM * share * 100) / 100;
        profiteers.push({ name, amount });
      }
    }

    // Merge duplicate profiteers across items.
    const merged = {};
    for (const p of profiteers) {
      merged[p.name] = (merged[p.name] || 0) + p.amount;
    }
    const mergedProfiteers = Object.entries(merged).map(([name, amount]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
    }));

    const formatted = {
      title: entry.title || "(payment)",
      type: entry.isPayment ? "payment" : "expense",
      payer,
      amount: totalAmount,
      currency: entry.currencyCode,
      split_between: mergedProfiteers,
      date: entry.date ? entry.date.iso : entry.createdGlobally.iso,
    };

    if (entry.category && !entry.category.__op) {
      formatted.category = entry.category.originalName;
    }

    return formatted;
  });

  process.stdout.write(JSON.stringify({ entries: result }));
}

main();
