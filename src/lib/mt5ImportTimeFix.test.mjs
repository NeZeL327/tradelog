import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MT5_TIME_FIX_CUTOFF_ISO,
  MT5_TIME_FIX_MARKER,
  classifyMt4TimeFixTrade,
  convertImportedMt4Times,
  planMt4ImportTimeFix,
  patchesFromFixRows,
  patchesFromBackupRestore,
  buildTimeFixBackup,
  parseTimeFixBackup,
  verifyTimeFix,
} from "./mt5ImportTimeFix.js";

const createdBefore = "2026-10-01T10:00:00.000Z";
const createdAfter = "2026-10-22T13:00:00.000Z";

function mt4(extra = {}) {
  return {
    id: extra.id || "t1",
    account_id: "acc1",
    symbol: "EURUSD",
    imported: true,
    import_broker: "mt4",
    createdAt: createdBefore,
    date: "2026-10-22",
    time: "09:36:12",
    entry_time: "09:36:12",
    close_date: "2026-10-22",
    exit_time: "10:05:05",
    profit_loss: -10,
    ...extra,
  };
}

describe("convertImportedMt4Times", () => {
  it("converts the 22.10 fixture −1h", () => {
    assert.deepEqual(convertImportedMt4Times(mt4()), {
      date: "2026-10-22",
      time: "08:36:12",
      entry_time: "08:36:12",
      close_date: "2026-10-22",
      exit_time: "09:05:05",
    });
  });

  it("rolls the date back at midnight", () => {
    const after = convertImportedMt4Times(
      mt4({ time: "00:30:00", entry_time: "00:30:00", exit_time: "10:05:05" })
    );
    assert.equal(after.date, "2026-10-21");
    assert.equal(after.entry_time, "23:30:00");
    assert.equal(after.close_date, "2026-10-22");
    assert.equal(after.exit_time, "09:05:05");
  });

  it("uses a 2h shift in the late-October window", () => {
    const after = convertImportedMt4Times(
      mt4({
        date: "2026-10-27",
        time: "12:00:00",
        entry_time: "12:00:00",
        close_date: "2026-10-27",
        exit_time: "13:00:00",
      })
    );
    assert.equal(after.entry_time, "10:00:00");
    assert.equal(after.exit_time, "11:00:00");
  });
});

describe("planMt4ImportTimeFix", () => {
  it("skips a row that already has the marker", () => {
    const plan = planMt4ImportTimeFix([mt4({ [MT5_TIME_FIX_MARKER]: true })]);
    assert.equal(plan.summary.toFix, 0);
    assert.equal(plan.skipped[0].reason, "already_fixed");
  });

  it("skips manual, FundedNext and MetaApi rows", () => {
    const plan = planMt4ImportTimeFix([
      mt4({ id: "manual", imported: false, import_broker: undefined }),
      mt4({ id: "fn", import_broker: "fundednext" }),
      mt4({ id: "api", import_broker: "mt5" }),
    ]);
    assert.deepEqual(
      plan.skipped.map((row) => row.reason),
      ["not_imported", "other_broker", "metaapi"]
    );
  });

  it("skips unknown createdAt and rows created after the Etap 2 cutoff", () => {
    const plan = planMt4ImportTimeFix([
      mt4({ id: "old" }),
      mt4({ id: "new", createdAt: createdAfter }),
      mt4({ id: "bare", createdAt: undefined }),
    ]);
    assert.equal(plan.toFix.length, 1);
    assert.equal(plan.toFix[0].id, "old");
    assert.equal(plan.skipped.find((row) => row.id === "new").reason, "created_after_cutoff");
    assert.equal(plan.skipped.find((row) => row.id === "bare").reason, "created_at_unknown");
  });

  it("counts midnight date changes and −2h rows", () => {
    const plan = planMt4ImportTimeFix([
      mt4({ id: "a" }),
      mt4({
        id: "b",
        time: "00:30:00",
        entry_time: "00:30:00",
      }),
      mt4({
        id: "c",
        date: "2026-10-27",
        time: "12:00:00",
        entry_time: "12:00:00",
        close_date: "2026-10-27",
        exit_time: "13:00:00",
      }),
    ]);
    assert.equal(plan.summary.toFix, 3);
    assert.equal(plan.summary.dayChanged, 1);
    assert.equal(plan.summary.shift1h, 2);
    assert.equal(plan.summary.shift2h, 1);
    assert.equal(plan.toFix.find((row) => row.id === "b").after.date, "2026-10-21");
  });

  it("second pass after the marker is 0 to change", () => {
    const first = planMt4ImportTimeFix([mt4()]);
    const patched = {
      ...mt4(),
      ...first.toFix[0].after,
      [MT5_TIME_FIX_MARKER]: true,
    };
    const second = planMt4ImportTimeFix([patched]);
    assert.equal(second.summary.toFix, 0);
  });
});

describe("backup and verify helpers", () => {
  it("builds patches with the marker and restores without it", () => {
    const plan = planMt4ImportTimeFix([mt4()]);
    const backup = buildTimeFixBackup({ userId: "u1", rows: plan.toFix });
    assert.equal(backup.version, "time_fix_v1");
    assert.equal(backup.cutoff_iso, MT5_TIME_FIX_CUTOFF_ISO);
    const apply = patchesFromFixRows(plan.toFix);
    assert.equal(apply[0].fields.entry_time, "08:36:12");
    assert.equal(apply[0].fields[MT5_TIME_FIX_MARKER], true);
    const restore = patchesFromBackupRestore(parseTimeFixBackup(backup));
    assert.equal(restore[0].fields.entry_time, "09:36:12");
    assert.deepEqual(restore[0].deleteKeys, [MT5_TIME_FIX_MARKER]);
  });

  it("verify keeps count and P&L, and checks sample clocks", () => {
    const before = [mt4(), mt4({ id: "t2", profit_loss: 5, imported: false })];
    const plan = planMt4ImportTimeFix(before);
    const after = before.map((trade) => {
      const row = plan.toFix.find((item) => item.id === trade.id);
      return row ? { ...trade, ...row.after, [MT5_TIME_FIX_MARKER]: true } : trade;
    });
    const report = verifyTimeFix({
      beforeTrades: before,
      afterTrades: after,
      backupRows: plan.toFix,
    });
    assert.equal(report.countUnchanged, true);
    assert.equal(report.pnlUnchanged, true);
    assert.equal(report.sampleAllMatch, true);
  });
});
