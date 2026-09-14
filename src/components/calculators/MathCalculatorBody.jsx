import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeBreakEven,
  computeMargin,
  computePipsValue,
  computePositionRisk,
  computeProfit,
  computeSessionDuration,
  computeTpSl,
  convertLots,
  formatNum,
} from "@/lib/calculatorMath";

function Field({ label, children }) {
  return (
    <label className="space-y-1 block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Result({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${accent || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function NumInput({ value, onChange, step = "any", ...rest }) {
  return (
    <Input
      type="number"
      step={step}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9"
      {...rest}
    />
  );
}

export default function MathCalculatorBody({ id, state, onChange }) {
  const patch = (partial) => onChange({ ...state, ...partial });

  if (id === "position-size" || id === "risk-reward") {
    const r = computePositionRisk({
      symbol: state.instrument || "EURUSD",
      direction: state.direction || "long",
      balance: state.balance,
      riskPct: state.riskPct,
      entry: state.entry,
      sl: state.sl,
      tp: state.tp,
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instrument">
            <Input value={state.instrument || "EURUSD"} onChange={(e) => patch({ instrument: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Kierunek">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={state.direction || "long"}
              onChange={(e) => patch({ direction: e.target.value })}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Saldo konta">
            <NumInput value={state.balance ?? "10000"} onChange={(v) => patch({ balance: v })} />
          </Field>
          <Field label="Ryzyko %">
            <NumInput value={state.riskPct ?? "1"} onChange={(v) => patch({ riskPct: v })} step="0.1" />
          </Field>
          <Field label="Entry">
            <NumInput value={state.entry} onChange={(v) => patch({ entry: v })} step="0.00001" />
          </Field>
          <Field label="Stop Loss">
            <NumInput value={state.sl} onChange={(v) => patch({ sl: v })} step="0.00001" />
          </Field>
          <Field label="Take Profit">
            <NumInput value={state.tp} onChange={(v) => patch({ tp: v })} step="0.00001" />
          </Field>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Result label="Risk $" value={formatNum(r.riskUsd, 2)} />
          <Result label="SL pips" value={formatNum(r.slPips, 1)} />
          <Result label="TP pips" value={formatNum(r.tpPips, 1)} />
          <Result label="Lot" value={formatNum(r.lots, 2)} accent="text-primary" />
          <Result label="R:R" value={r.rr ? `1:${formatNum(r.rr, 2)}` : "—"} accent="text-primary" />
          <Result label="Potential loss" value={formatNum(r.potentialLoss, 2)} />
          <Result label="Potential profit" value={formatNum(r.potentialProfit, 2)} />
          <Result label="Pip value / lot" value={formatNum(r.pipValue, 2)} />
        </div>
      </div>
    );
  }

  if (id === "pips-value") {
    const r = computePipsValue({
      symbol: state.instrument || "EURUSD",
      price: state.price,
      lots: state.lots,
      pips: state.pips,
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instrument"><Input value={state.instrument || "EURUSD"} onChange={(e) => patch({ instrument: e.target.value.toUpperCase() })} /></Field>
          <Field label="Cena"><NumInput value={state.price} onChange={(v) => patch({ price: v })} step="0.00001" /></Field>
          <Field label="Loty"><NumInput value={state.lots ?? "1"} onChange={(v) => patch({ lots: v })} step="0.01" /></Field>
          <Field label="Pipsy"><NumInput value={state.pips ?? "10"} onChange={(v) => patch({ pips: v })} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Result label="Pip / 1 lot" value={formatNum(r.pipValue, 2)} />
          <Result label="Wartość ruchu" value={formatNum(r.value, 2)} accent="text-primary" />
          <Result label="1 lot × pips" value={formatNum(r.oneLot, 2)} />
        </div>
      </div>
    );
  }

  if (id === "margin") {
    const r = computeMargin({ price: state.price, lots: state.lots, leverage: state.leverage });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Cena"><NumInput value={state.price} onChange={(v) => patch({ price: v })} step="0.00001" /></Field>
          <Field label="Loty"><NumInput value={state.lots ?? "1"} onChange={(v) => patch({ lots: v })} step="0.01" /></Field>
          <Field label="Dźwignia"><NumInput value={state.leverage ?? "100"} onChange={(v) => patch({ leverage: v })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Result label="Notional" value={formatNum(r.notional, 2)} />
          <Result label="Margin" value={formatNum(r.margin, 2)} accent="text-primary" />
        </div>
      </div>
    );
  }

  if (id === "break-even") {
    const r = computeBreakEven({
      entry: state.entry,
      lots: state.lots,
      commission: state.commission,
      symbol: state.instrument || "EURUSD",
      direction: state.direction || "long",
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instrument"><Input value={state.instrument || "EURUSD"} onChange={(e) => patch({ instrument: e.target.value.toUpperCase() })} /></Field>
          <Field label="Kierunek">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={state.direction || "long"} onChange={(e) => patch({ direction: e.target.value })}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Entry"><NumInput value={state.entry} onChange={(v) => patch({ entry: v })} step="0.00001" /></Field>
          <Field label="Loty"><NumInput value={state.lots ?? "0.5"} onChange={(v) => patch({ lots: v })} step="0.01" /></Field>
          <Field label="Prowizja / spread $"><NumInput value={state.commission ?? "0"} onChange={(v) => patch({ commission: v })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Result label="BE pips" value={formatNum(r.bePips, 1)} />
          <Result label="BE price" value={formatNum(r.bePrice, 5)} accent="text-primary" />
        </div>
      </div>
    );
  }

  if (id === "profit") {
    const r = computeProfit({
      symbol: state.instrument || "EURUSD",
      entry: state.entry,
      exit: state.exit,
      lots: state.lots,
      direction: state.direction || "long",
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instrument"><Input value={state.instrument || "EURUSD"} onChange={(e) => patch({ instrument: e.target.value.toUpperCase() })} /></Field>
          <Field label="Kierunek">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={state.direction || "long"} onChange={(e) => patch({ direction: e.target.value })}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Entry"><NumInput value={state.entry} onChange={(v) => patch({ entry: v })} step="0.00001" /></Field>
          <Field label="Exit"><NumInput value={state.exit} onChange={(v) => patch({ exit: v })} step="0.00001" /></Field>
          <Field label="Loty"><NumInput value={state.lots ?? "1"} onChange={(v) => patch({ lots: v })} step="0.01" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Result label="Pips" value={formatNum(r.pips, 1)} />
          <Result label="Profit" value={formatNum(r.profit, 2)} accent={r.profit >= 0 ? "text-profit" : "text-loss"} />
        </div>
      </div>
    );
  }

  if (id === "tp-sl") {
    const r = computeTpSl({
      entry: state.entry,
      slPips: state.slPips,
      rr: state.rr,
      symbol: state.instrument || "EURUSD",
      direction: state.direction || "long",
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instrument"><Input value={state.instrument || "EURUSD"} onChange={(e) => patch({ instrument: e.target.value.toUpperCase() })} /></Field>
          <Field label="Kierunek">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={state.direction || "long"} onChange={(e) => patch({ direction: e.target.value })}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Entry"><NumInput value={state.entry} onChange={(v) => patch({ entry: v })} step="0.00001" /></Field>
          <Field label="SL (pips)"><NumInput value={state.slPips ?? "20"} onChange={(v) => patch({ slPips: v })} /></Field>
          <Field label="R:R"><NumInput value={state.rr ?? "2"} onChange={(v) => patch({ rr: v })} step="0.1" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Result label="SL price" value={formatNum(r.slPrice, 5)} />
          <Result label="TP price" value={formatNum(r.tpPrice, 5)} accent="text-primary" />
          <Result label="TP pips" value={formatNum(r.tpPips, 1)} />
        </div>
      </div>
    );
  }

  if (id === "time") {
    const r = computeSessionDuration(state.start || "08:00", state.end || "12:00");
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Od"><Input type="time" value={state.start || "08:00"} onChange={(e) => patch({ start: e.target.value })} /></Field>
          <Field label="Do"><Input type="time" value={state.end || "12:00"} onChange={(e) => patch({ end: e.target.value })} /></Field>
        </div>
        <Result label="Czas trwania" value={r.label} accent="text-primary" />
      </div>
    );
  }

  if (id === "lot-converter") {
    const r = convertLots(state.lots ?? "1", state.from || "standard");
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Wartość">
            <NumInput value={state.lots ?? "1"} onChange={(v) => patch({ lots: v })} step="0.01" />
          </Field>
          <Field label="Jednostka wejściowa">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={state.from || "standard"} onChange={(e) => patch({ from: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="mini">Mini</option>
              <option value="micro">Micro</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Result label="Standard" value={formatNum(r.standard, 2)} />
          <Result label="Mini" value={formatNum(r.mini, 2)} />
          <Result label="Micro" value={formatNum(r.micro, 2)} />
        </div>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Nieznany kalkulator.</p>;
}

export function MathFieldLabel(props) {
  return <Label {...props} />;
}
