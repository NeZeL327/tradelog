import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTradesFromCSV } from "./csv-trade-import.js";

const MT5_FIXTURE = [
  "Czas,Pozycja,Symbol,Typ,Wolumen,Cena,S / L,T / P,Czas,Cena,Prowizja,Swap,Zysk",
  "2026.10.22 09:36:12,179001,EURUSD,sell,0.10,1.08000,0,0,2026.10.22 10:05:05,1.08100,-0.50,0,-10.00",
].join("\n");

const FUNDEDNEXT_FIXTURE = [
  "Ticket ID,Open Time,Close Time,Symbol,Type,Lots,Open Price,Close Price,Commission,Swap,Profit",
  "99,2026.10.22 09:36:12,2026.10.22 10:05:05,EURUSD,sell,0.10,1.08,1.081,0,0,-10",
].join("\n");

const MT5_MIDNIGHT_FIXTURE = [
  "Czas,Pozycja,Symbol,Typ,Wolumen,Cena,S / L,T / P,Czas,Cena,Prowizja,Swap,Zysk",
  "2026.10.22 00:30:00,179002,EURUSD,sell,0.10,1.08000,0,0,2026.10.22 10:05:05,1.08100,0,0,-10.00",
].join("\n");

describe("MT4/MT5 import server time", () => {
  it("converts open 09:36:12 and close 10:05:05 to Prague 08:36:12 / 09:05:05", () => {
    const { trades, format } = parseTradesFromCSV(MT5_FIXTURE, {
      accountId: "acc1",
      brokerId: "mt4",
    });
    assert.equal(format, "mt4");
    assert.equal(trades.length, 1);
    const trade = trades[0];
    assert.equal(trade.import_broker, "mt4");
    assert.equal(trade.date, "2026-10-22");
    assert.equal(trade.time, "08:36:12");
    assert.equal(trade.entry_time, "08:36:12");
    assert.equal(trade.close_date, "2026-10-22");
    assert.equal(trade.exit_time, "09:05:05");
    assert.equal(trade.external_ticket, "179001");
    assert.equal(trade.symbol, "EURUSD");
    assert.equal(trade.position_size, 0.1);
    assert.equal(trade.profit_loss_gross, -10);
  });

  it("converts open and close independently across midnight", () => {
    const { trades } = parseTradesFromCSV(MT5_MIDNIGHT_FIXTURE, {
      accountId: "acc1",
      brokerId: "mt4",
    });
    assert.equal(trades.length, 1);
    assert.equal(trades[0].date, "2026-10-21");
    assert.equal(trades[0].entry_time, "23:30:00");
    assert.equal(trades[0].close_date, "2026-10-22");
    assert.equal(trades[0].exit_time, "09:05:05");
  });

  it("does not convert FundedNext file times", () => {
    const { trades, format } = parseTradesFromCSV(FUNDEDNEXT_FIXTURE, {
      accountId: "acc1",
      brokerId: "fundednext",
    });
    assert.equal(format, "fundednext");
    assert.equal(trades.length, 1);
    assert.equal(trades[0].date, "2026-10-22");
    assert.equal(trades[0].entry_time, "09:36:12");
    assert.equal(trades[0].exit_time, "10:05:05");
  });
});
