import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serverToLocal } from "./brokerTime.js";

const prague = { userTimeZone: "Europe/Prague" };

function local(dateStr, timeStr) {
  return serverToLocal(dateStr, timeStr, prague);
}

describe("serverToLocal NY+7 → Europe/Prague", () => {
  it("2026-01-15 12:00 → −1h (both winter)", () => {
    assert.deepEqual(local("2026-01-15", "12:00:00"), {
      date: "2026-01-15",
      time: "11:00:00",
    });
  });

  it("2026-03-10 12:00 → −2h (US summer, EU winter)", () => {
    assert.deepEqual(local("2026-03-10", "12:00:00"), {
      date: "2026-03-10",
      time: "10:00:00",
    });
  });

  it("2026-07-15 12:00 → −1h (both summer)", () => {
    assert.deepEqual(local("2026-07-15", "12:00:00"), {
      date: "2026-07-15",
      time: "11:00:00",
    });
  });

  it("2026-10-22 09:36:12 → 08:36:12", () => {
    assert.deepEqual(local("2026-10-22", "09:36:12"), {
      date: "2026-10-22",
      time: "08:36:12",
    });
  });

  it("2026-10-27 12:00 → −2h (EU winter, US still summer)", () => {
    assert.deepEqual(local("2026-10-27", "12:00:00"), {
      date: "2026-10-27",
      time: "10:00:00",
    });
  });

  it("2026-11-02 12:00 → −1h (both winter)", () => {
    assert.deepEqual(local("2026-11-02", "12:00:00"), {
      date: "2026-11-02",
      time: "11:00:00",
    });
  });

  it("rolls back a day on a 1h gap: 2026-10-22 00:30 → 2026-10-21 23:30", () => {
    assert.deepEqual(local("2026-10-22", "00:30:00"), {
      date: "2026-10-21",
      time: "23:30:00",
    });
  });

  it("rolls back a day on a 2h gap: 2026-10-27 01:30 → 2026-10-26 23:30", () => {
    assert.deepEqual(local("2026-10-27", "01:30:00"), {
      date: "2026-10-26",
      time: "23:30:00",
    });
  });
});

describe("serverToLocal DST Sundays 2026", () => {
  it("US spring-forward Sunday 2026-03-08 12:00 → −2h", () => {
    assert.deepEqual(local("2026-03-08", "12:00:00"), {
      date: "2026-03-08",
      time: "10:00:00",
    });
  });

  it("EU spring-forward Sunday 2026-03-29 12:00 → −1h", () => {
    assert.deepEqual(local("2026-03-29", "12:00:00"), {
      date: "2026-03-29",
      time: "11:00:00",
    });
  });

  it("EU fall-back Sunday 2026-10-25 12:00 → −2h", () => {
    assert.deepEqual(local("2026-10-25", "12:00:00"), {
      date: "2026-10-25",
      time: "10:00:00",
    });
  });

  it("US fall-back Sunday 2026-11-01 12:00 → −1h", () => {
    assert.deepEqual(local("2026-11-01", "12:00:00"), {
      date: "2026-11-01",
      time: "11:00:00",
    });
  });
});

describe("serverToLocal options and format", () => {
  it("defaults to America/New_York +7h → Europe/Prague", () => {
    assert.deepEqual(serverToLocal("2026-10-22", "09:36:12"), {
      date: "2026-10-22",
      time: "08:36:12",
    });
  });

  it("pads HH:MM to HH:MM:SS like import storage", () => {
    assert.deepEqual(local("2026-10-22", "09:36"), {
      date: "2026-10-22",
      time: "08:36:00",
    });
  });

  it("is configurable as IANA zone + hour offset", () => {
    const shifted = serverToLocal("2026-10-22", "09:36:12", {
      ...prague,
      serverTimeZone: "America/New_York",
      serverOffsetHours: 8,
    });
    assert.notDeepEqual(shifted, { date: "2026-10-22", time: "08:36:12" });
    assert.equal(shifted.date, "2026-10-22");
    assert.equal(shifted.time, "07:36:12");
  });

  it("returns empty strings for invalid input", () => {
    assert.deepEqual(serverToLocal("", "09:36:12"), { date: "", time: "" });
    assert.deepEqual(serverToLocal("2026-10-22", ""), { date: "", time: "" });
  });
});
