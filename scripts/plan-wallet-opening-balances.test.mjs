import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("./plan-wallet-opening-balances.mjs", import.meta.url)
);
const wallet = () => ({
  userId: 7,
  ownerState: "live",
  balance: 77,
  bonusCredits: 500,
  lifetimeSpent: 100,
  walletAccountingVersion: 0,
  updatedAt: "2026-10-16T00:00:00.123456Z",
});
const review = (w = wallet()) => ({
  userId: w.userId,
  approved: true,
  reviewer: "synthetic-independent-reviewer",
  expectedBalance: w.balance,
  expectedBonusCredits: w.bonusCredits,
  expectedLifetimeSpent: w.lifetimeSpent,
  expectedUpdatedAt: w.updatedAt,
  purchasedRemaining: 25,
  evidenceTransactionIds: [101, 102],
});
const absenceWallet = () => ({
  ...wallet(),
  ledgerRowCount: 0,
  ledgerEvidenceId: "synthetic-ledger-snapshot-7",
  ledgerVerifiedAt: "2026-10-17T00:00:00.654321Z",
});
const absenceReview = (w = absenceWallet()) => ({
  ...review(w),
  purchasedRemaining: 0,
  evidenceTransactionIds: [],
  absenceEvidence: {
    kind: "reviewed-zero-purchased-without-ledger",
    ledgerRowCount: 0,
    ledgerEvidenceId: w.ledgerEvidenceId,
    ledgerVerifiedAt: w.ledgerVerifiedAt,
    zeroRemainingPurchasedApproved: true,
    rationale:
      "Synthetic test only: a separate reviewer established zero remaining purchased credits from independent provenance, not the missing ledger.",
    independentEvidenceRefs: [
      "synthetic-only:independent-purchased-provenance-review-7",
    ],
  },
});

async function fixture(run) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "dreamforge-opening-contract-")
  );
  const files = {
    snapshot: path.join(directory, "snapshot.json"),
    reviews: path.join(directory, "reviews.json"),
    output: path.join(directory, "plan.json"),
  };
  try {
    let outputIndex = 0;
    const plan = async (snapshot, reviews, extraArgs = []) => {
      files.output = path.join(directory, `plan-${outputIndex++}.json`);
      await writeFile(files.snapshot, JSON.stringify(snapshot));
      await writeFile(files.reviews, JSON.stringify(reviews));
      execFileSync(
        process.execPath,
        [script, files.snapshot, files.reviews, files.output, ...extraArgs],
        { stdio: "pipe" }
      );
      return JSON.parse(await readFile(files.output, "utf8"));
    };
    await run({ plan, files });
  } finally {
    const resolved = path.resolve(directory),
      temporaryRoot = path.resolve(tmpdir());
    assert.equal(
      path.dirname(resolved),
      temporaryRoot,
      "Cleanup must remain under the owned temporary root."
    );
    assert.ok(
      path.basename(resolved).startsWith("dreamforge-opening-contract-")
    );
    await rm(resolved, { recursive: true, force: true });
  }
}

test("transaction review preserves money, locks a live owner, binds evidence ownership and preserves timestamp microseconds", async () => {
  await fixture(async ({ plan, files }) => {
    const w = wallet(),
      r = review(w),
      result = await plan([w], [r]);
    assert.equal(result.dryRun, true);
    assert.equal(result.executionSupported, false);
    assert.equal(result.releaseBlocked, false);
    assert.equal(result.plan.length, 1);
    assert.equal(result.plan[0].evidenceMode, "transaction-ledger");
    assert.equal(result.plan[0].preservedBalance, 77);
    assert.equal(result.plan[0].purchasedRemaining, 25);
    const sql = result.plan[0].sql;
    assert.match(sql, /WITH live_owner AS MATERIALIZED/);
    assert.match(sql, /"loginMethod" IS DISTINCT FROM 'deleted' FOR SHARE/);
    assert.match(sql, /AND EXISTS \(SELECT 1 FROM live_owner\)/);
    assert.match(
      sql,
      /evidence\."userId" = cb\."userId" AND evidence\.id IN \(101, 102\)\) = 2/
    );
    assert.match(sql, /cb\."walletAccountingVersion" = 0/);
    assert.match(sql, /cb\.balance = 77/);
    assert.match(sql, /cb\."bonusCredits" = 500/);
    assert.match(sql, /cb\."lifetimeSpent" = 100/);
    assert.ok(sql.includes(w.updatedAt));
    assert.ok(!sql.includes("00:00:00.123Z"));
    assert.equal(
      sql.match(/ SET (.*?) WHERE /s)?.[1],
      '"bonusCredits" = 25, "walletAccountingVersion" = 1'
    );
    assert.deepEqual(JSON.parse(await readFile(files.snapshot, "utf8")), [w]);
    assert.deepEqual(JSON.parse(await readFile(files.reviews, "utf8")), [r]);
  });
});

test("independently approved absence plans zero purchased credits with an execution-time zero-ledger guard", async () => {
  await fixture(async ({ plan }) => {
    const w = absenceWallet(),
      result = await plan([w], [absenceReview(w)]),
      entry = result.plan[0];
    assert.equal(result.releaseBlocked, false);
    assert.equal(entry.evidenceMode, "reviewed-absence");
    assert.equal(entry.preservedBalance, 77);
    assert.equal(entry.expectedSnapshot.bonusCredits, 500);
    assert.equal(entry.purchasedRemaining, 0);
    assert.deepEqual(entry.evidenceTransactionIds, []);
    assert.equal(entry.absenceEvidence.ledgerEvidenceId, w.ledgerEvidenceId);
    assert.match(
      entry.sql,
      /NOT EXISTS \(SELECT 1 FROM "creditTransactions" evidence WHERE evidence\."userId" = cb\."userId"\)/
    );
    assert.equal(
      entry.sql.match(/ SET (.*?) WHERE /s)?.[1],
      '"bonusCredits" = 0, "walletAccountingVersion" = 1'
    );
  });
});

test("missing ledger and zero bonus do not grant approval or infer zero purchased credits", async () => {
  await fixture(async ({ plan }) => {
    const w = { ...absenceWallet(), bonusCredits: 0 };
    for (const reviews of [
      [],
      [{ ...review(w), evidenceTransactionIds: [], purchasedRemaining: 0 }],
    ]) {
      const result = await plan([w], reviews);
      assert.equal(result.releaseBlocked, true);
      assert.equal(result.plan.length, 0);
      assert.equal(result.blocked.length, 1);
    }
  });
});

for (const [name, mutate] of [
  [
    "missing owner",
    w => {
      delete w.ownerState;
    },
  ],
  [
    "unknown owner",
    w => {
      w.ownerState = "unknown";
    },
  ],
  [
    "implicit active owner",
    w => {
      w.ownerState = "active";
    },
  ],
])
  test(`${name} blocks both review paths`, async () => {
    await fixture(async ({ plan }) => {
      for (const absence of [false, true]) {
        const w = absence ? absenceWallet() : wallet(),
          r = absence ? absenceReview(w) : review(w);
        mutate(w);
        const result = await plan([w], [r]);
        assert.equal(result.releaseBlocked, true);
        assert.equal(result.plan.length, 0);
      }
    });
  });

test("explicit deleted owners are excluded without approval or UPDATE statements", async () => {
  await fixture(async ({ plan }) => {
    const deleted = Array.from({ length: 12 }, (_, index) => ({
      ...wallet(),
      userId: 100 + index,
      ownerState: "deleted",
      balance: 0,
    }));
    const result = await plan(deleted, [
      { ...review(deleted[0]), purchasedRemaining: 500 },
    ]);
    assert.equal(result.plan.length, 0);
    assert.equal(result.excluded.length, 12);
    assert.equal(result.releaseBlocked, false);
    assert.ok(
      result.excluded.every(
        entry =>
          entry.ownerState === "deleted" &&
          entry.preservedBalance === 0 &&
          !Object.hasOwn(entry, "sql")
      )
    );
  });
});

test("deleted-owner exclusions preserve a retained nonzero balance and do not reopen the account", async () => {
  await fixture(async ({ plan }) => {
    const result = await plan(
      [{ ...wallet(), ownerState: "deleted", balance: 99 }],
      []
    );
    assert.equal(result.plan.length, 0);
    assert.equal(result.excluded[0].preservedBalance, 99);
  });
});

test("already-current wallets still require explicit owner evidence", async () => {
  await fixture(async ({ plan }) => {
    const w = { ...wallet(), walletAccountingVersion: 1 };
    const current = await plan([w], []);
    assert.equal(current.plan.length, 0);
    assert.equal(current.alreadyCurrent.length, 1);
    delete w.ownerState;
    assert.equal((await plan([w], [])).releaseBlocked, true);
  });
});

for (const [name, mutate] of [
  [
    "unapproved review",
    (_w, r) => {
      r.approved = false;
    },
  ],
  [
    "unnamed reviewer",
    (_w, r) => {
      r.reviewer = " ";
    },
  ],
  [
    "changed balance",
    (_w, r) => {
      r.expectedBalance++;
    },
  ],
  [
    "missing bonus snapshot",
    (_w, r) => {
      delete r.expectedBonusCredits;
    },
  ],
  [
    "changed bonus snapshot",
    (_w, r) => {
      r.expectedBonusCredits++;
    },
  ],
  [
    "changed lifetime spend",
    (_w, r) => {
      r.expectedLifetimeSpent++;
    },
  ],
  [
    "changed microsecond timestamp",
    (_w, r) => {
      r.expectedUpdatedAt = "2026-10-16T00:00:00.123457Z";
    },
  ],
  [
    "excessive purchased remainder",
    (_w, r) => {
      r.purchasedRemaining = 78;
    },
  ],
  [
    "negative purchased remainder",
    (_w, r) => {
      r.purchasedRemaining = -1;
    },
  ],
])
  test(`${name} blocks transaction and absence reviews`, async () => {
    await fixture(async ({ plan }) => {
      for (const absence of [false, true]) {
        const w = absence ? absenceWallet() : wallet(),
          r = absence ? absenceReview(w) : review(w);
        mutate(w, r);
        const result = await plan([w], [r]);
        assert.equal(result.releaseBlocked, true);
        assert.equal(result.plan.length, 0);
      }
    });
  });

for (const ids of [[], [0], [-1], [1.5], ["101"], [101, 101]])
  test(`transaction evidence rejects ${JSON.stringify(ids)}`, async () => {
    await fixture(async ({ plan }) => {
      const result = await plan(
        [wallet()],
        [{ ...review(), evidenceTransactionIds: ids }]
      );
      assert.equal(result.releaseBlocked, true);
      assert.equal(result.plan.length, 0);
    });
  });

test("normal transaction evidence cannot contradict a captured zero-ledger count", async () => {
  await fixture(async ({ plan }) => {
    assert.equal(
      (await plan([absenceWallet()], [review()])).releaseBlocked,
      true
    );
  });
});

for (const [name, mutate] of [
  [
    "missing ledger count",
    w => {
      delete w.ledgerRowCount;
    },
  ],
  [
    "nonzero ledger count",
    w => {
      w.ledgerRowCount = 1;
    },
  ],
  [
    "string ledger count",
    w => {
      w.ledgerRowCount = "0";
    },
  ],
  [
    "missing ledger capture",
    w => {
      delete w.ledgerVerifiedAt;
    },
  ],
  [
    "old ledger capture",
    (w, r) => {
      w.ledgerVerifiedAt = r.absenceEvidence.ledgerVerifiedAt =
        "2026-10-16T00:00:00.123455Z";
    },
  ],
  [
    "unbound capture time",
    (_w, r) => {
      r.absenceEvidence.ledgerVerifiedAt = "2026-10-17T00:00:00.654322Z";
    },
  ],
  [
    "missing capture reference",
    w => {
      delete w.ledgerEvidenceId;
    },
  ],
  [
    "unbound capture reference",
    (_w, r) => {
      r.absenceEvidence.ledgerEvidenceId = "different-synthetic-snapshot";
    },
  ],
  [
    "positive purchased remainder",
    (_w, r) => {
      r.purchasedRemaining = 1;
    },
  ],
  [
    "fabricated transaction ID",
    (_w, r) => {
      r.evidenceTransactionIds = [999];
    },
  ],
  [
    "wrong evidence kind",
    (_w, r) => {
      r.absenceEvidence.kind = "assumed-unpaid";
    },
  ],
  [
    "missing explicit zero approval",
    (_w, r) => {
      delete r.absenceEvidence.zeroRemainingPurchasedApproved;
    },
  ],
  [
    "string zero approval",
    (_w, r) => {
      r.absenceEvidence.zeroRemainingPurchasedApproved = "true";
    },
  ],
  [
    "missing rationale",
    (_w, r) => {
      r.absenceEvidence.rationale = "";
    },
  ],
  [
    "no independent references",
    (_w, r) => {
      r.absenceEvidence.independentEvidenceRefs = [];
    },
  ],
  [
    "ledger absence as the only reference",
    (w, r) => {
      r.absenceEvidence.independentEvidenceRefs = [w.ledgerEvidenceId];
    },
  ],
  [
    "blank independent reference",
    (_w, r) => {
      r.absenceEvidence.independentEvidenceRefs = [" "];
    },
  ],
  [
    "duplicate independent reference",
    (_w, r) => {
      r.absenceEvidence.independentEvidenceRefs = [
        "synthetic-review",
        "synthetic-review",
      ];
    },
  ],
  [
    "mixed null absence evidence",
    (_w, r) => {
      r.absenceEvidence = null;
    },
  ],
])
  test(`absence review rejects ${name}`, async () => {
    await fixture(async ({ plan }) => {
      const w = absenceWallet(),
        r = absenceReview(w);
      mutate(w, r);
      const result = await plan([w], [r]);
      assert.equal(result.releaseBlocked, true);
      assert.equal(result.plan.length, 0);
    });
  });

test("duplicate reviews and incomplete cohorts block release despite other valid planned statements", async () => {
  await fixture(async ({ plan }) => {
    assert.equal(
      (await plan([wallet()], [review(), review()])).releaseBlocked,
      true
    );
    const result = await plan(
      [wallet(), { ...wallet(), userId: 8, ownerState: "unknown" }],
      [review()]
    );
    assert.equal(result.releaseBlocked, true);
    assert.equal(result.plan.length, 1);
    assert.equal(result.blocked[0].userId, 8);
  });
});

test("a negative wallet keeps its debt and permits only zero remaining purchased credits", async () => {
  await fixture(async ({ plan }) => {
    const w = { ...wallet(), balance: -7 },
      r = { ...review(w), purchasedRemaining: 0 },
      result = await plan([w], [r]);
    assert.equal(result.releaseBlocked, false);
    assert.equal(result.plan[0].preservedBalance, -7);
    assert.match(result.plan[0].sql, /cb\.balance = -7/);
    assert.equal(
      (await plan([w], [{ ...r, purchasedRemaining: 1 }])).releaseBlocked,
      true
    );
  });
});

test("review text and evidence references are retained only as JSON, never interpolated into SQL", async () => {
  await fixture(async ({ plan }) => {
    const w = absenceWallet(),
      r = absenceReview(w);
    r.reviewer = "synthetic reviewer ' quote";
    r.absenceEvidence.rationale =
      "Synthetic evidence includes a harmless SQL-like phrase: DROP TABLE users.";
    r.absenceEvidence.independentEvidenceRefs = [
      "synthetic-review:'; SQL-like text only",
    ];
    const result = await plan([w], [r]);
    assert.equal(result.releaseBlocked, false);
    assert.ok(!result.plan[0].sql.includes(r.reviewer));
    assert.ok(!result.plan[0].sql.includes("DROP TABLE"));
    assert.ok(!result.plan[0].sql.includes("SQL-like"));
  });
});

for (const updatedAt of [
  "2026-02-30T00:00:00.000Z",
  "2026-10-16T24:00:00Z",
  "2026-10-16T00:00:00",
  "2026-10-16T00:00:00.1234567Z",
  "2026-10-16T00:00:00Z'); SQL-like text",
  "0000-01-01T00:00:00Z",
])
  test(`invalid timestamp fails closed: ${updatedAt}`, async () => {
    await fixture(async ({ plan, files }) => {
      const w = { ...wallet(), updatedAt };
      await assert.rejects(plan([w], [review(w)]));
      await assert.rejects(readFile(files.output), { code: "ENOENT" });
    });
  });

test("duplicate wallets, out-of-range amounts and extra execution flags fail without a plan", async () => {
  await fixture(async ({ plan, files }) => {
    await assert.rejects(plan([wallet(), wallet()], [review()]));
    await assert.rejects(
      plan([{ ...wallet(), balance: 2_147_483_648 }], [review()])
    );
    await assert.rejects(plan([wallet()], [review()], ["--execute"]));
    await assert.rejects(readFile(files.output), { code: "ENOENT" });
  });
});

test("an output path cannot overwrite either evidence input", async () => {
  await fixture(async ({ files }) => {
    const snapshot = JSON.stringify([wallet()]),
      reviews = JSON.stringify([review()]);
    await writeFile(files.snapshot, snapshot);
    await writeFile(files.reviews, reviews);
    for (const output of [files.snapshot, files.reviews])
      assert.throws(() =>
        execFileSync(
          process.execPath,
          [script, files.snapshot, files.reviews, output],
          { stdio: "pipe" }
        )
      );
    assert.equal(await readFile(files.snapshot, "utf8"), snapshot);
    assert.equal(await readFile(files.reviews, "utf8"), reviews);
  });
});

test("exclusive output creation preserves existing files and hard-linked evidence aliases", async () => {
  await fixture(async ({ files }) => {
    const snapshot = JSON.stringify([wallet()]),
      reviews = JSON.stringify([review()]);
    await writeFile(files.snapshot, snapshot);
    await writeFile(files.reviews, reviews);
    await writeFile(files.output, "existing output must be preserved");
    const invoke = () =>
      execFileSync(
        process.execPath,
        [script, files.snapshot, files.reviews, files.output],
        { stdio: "pipe" }
      );
    assert.throws(invoke);
    assert.equal(
      await readFile(files.output, "utf8"),
      "existing output must be preserved"
    );
    await rm(files.output);
    for (const input of [files.snapshot, files.reviews]) {
      await link(input, files.output);
      assert.throws(invoke);
      assert.equal(await readFile(files.snapshot, "utf8"), snapshot);
      assert.equal(await readFile(files.reviews, "utf8"), reviews);
      await rm(files.output);
    }
  });
});
