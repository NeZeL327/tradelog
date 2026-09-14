import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { APLUS_SCORE_GROUPS, formatPoints, pointsToneClass } from "@/lib/aPlusConfigScore";
import { M1_MASTERY_OPTIONS } from "@/lib/m1MasteryScore";
import {
  CONDITION_TYPES,
  emptyCondition,
  isConditionMet,
} from "@/lib/calculatorScoring";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

function typeLabel(type) {
  const map = {
    boolean: "Checkbox",
    select: "Wybór",
    multi: "Multi",
    number: "Liczbowa",
    text: "Tekst",
    time: "Czas",
    timeRange: "Zakres czasu",
  };
  return map[type] || type;
}

function ConditionEditor({ open, condition, onClose, onSave }) {
  const [draft, setDraft] = useState(condition || emptyCondition());
  useEffect(() => {
    if (open) setDraft(condition || emptyCondition());
  }, [open, condition]);

  const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{condition?.id ? "Edytuj warunek" : "Dodaj warunek"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Nazwa</span>
            <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Typ</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={draft.type}
              onChange={(e) => patch({ type: e.target.value })}
            >
              {CONDITION_TYPES.map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Operator</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={draft.operator || ">="}
              onChange={(e) => patch({ operator: e.target.value })}
            >
              {["=", "!=", ">=", "<=", ">", "<"].map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Wartość / próg</span>
            <Input value={draft.value} onChange={(e) => patch({ value: e.target.value })} placeholder="2 lub London" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Jednostka</span>
            <Input value={draft.unit} onChange={(e) => patch({ unit: e.target.value })} placeholder="pips" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <Input value={draft.timeframe} onChange={(e) => patch({ timeframe: e.target.value })} placeholder="M5" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Punkty</span>
            <Input type="number" value={draft.points} onChange={(e) => patch({ points: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 pt-2">
            <Checkbox checked={Boolean(draft.required)} onCheckedChange={(v) => patch({ required: Boolean(v) })} />
            <span className="text-sm">Wymagany</span>
          </label>
          {(draft.type === "select" || draft.type === "multi") && (
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Opcje (przecinkami)</span>
              <Input
                value={Array.isArray(draft.options) ? draft.options.join(", ") : draft.options || ""}
                onChange={(e) => patch({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </label>
          )}
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Opis</span>
            <Textarea value={draft.description || ""} onChange={(e) => patch({ description: e.target.value })} rows={2} />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          <Button
            type="button"
            onClick={() => {
              if (!String(draft.name || "").trim()) return;
              onSave({ ...draft, name: String(draft.name).trim() });
            }}
          >
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function valueInput(cond, actual, onChange) {
  if (cond.type === "boolean") return null;
  if (cond.type === "select") {
    const opts = cond.options?.length ? cond.options : String(cond.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    return (
      <select
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        value={actual || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (cond.type === "multi") {
    return (
      <Input
        className="h-8 text-xs"
        value={Array.isArray(actual) ? actual.join(", ") : actual || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="a, b"
      />
    );
  }
  if (cond.type === "time" || cond.type === "timeRange") {
    return <Input className="h-8 text-xs" type={cond.type === "time" ? "time" : "text"} value={actual || ""} onChange={(e) => onChange(e.target.value)} placeholder="08:00-12:00" />;
  }
  return (
    <Input
      className="h-8 text-xs"
      type={cond.type === "number" ? "number" : "text"}
      value={actual ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={cond.value ? String(cond.value) : ""}
    />
  );
}

function ScoreRow({ checked, label, points, onToggle, code }) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm leading-tight",
        checked ? "bg-primary/10" : "hover:bg-muted/50"
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="h-4 w-4" />
      <span className="flex-1 min-w-0 text-foreground">
        {code ? <span className="font-semibold">{code} — </span> : null}
        {label}
      </span>
      <span className={cn("tabular-nums text-xs shrink-0 font-semibold", pointsToneClass(points))}>
        {formatPoints(points)}
      </span>
    </label>
  );
}

export default function SetupCalculatorBody({
  kind,
  aplusSelection,
  m1Selection,
  extraConditions,
  extraValues,
  onToggleAplus,
  onToggleM1,
  onExtraValues,
  onExtraConditions,
}) {
  const [editor, setEditor] = useState(null);
  const extras = extraConditions || [];

  return (
    <div className="space-y-5">
      {kind === "aplus" && (
        <div className="space-y-4">
          {APLUS_SCORE_GROUPS.map((group) => {
            const selected = aplusSelection?.[group.id] || [];
            return (
              <section key={group.id} className="space-y-1">
                <div className="px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </p>
                  {group.subtitle ? (
                    <p className="text-[11px] text-muted-foreground/80">{group.subtitle}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border/70 bg-card/40 p-1.5">
                  {group.options.map((opt) => (
                    <ScoreRow
                      key={opt.id}
                      checked={selected.includes(opt.id)}
                      label={opt.label}
                      points={opt.points}
                      onToggle={() => onToggleAplus(group.id, opt.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {kind === "m1" && (
        <section className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            M1 MASTERY
          </p>
          <div className="rounded-xl border border-border/70 bg-card/40 p-1.5">
            {M1_MASTERY_OPTIONS.map((opt) => (
              <ScoreRow
                key={opt.id}
                checked={(m1Selection || []).includes(opt.id)}
                code={opt.code}
                label={opt.label}
                points={opt.points}
                onToggle={() => onToggleM1(opt.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{kind === "custom" ? "Warunki wejścia" : "Własne warunki"}</h3>
          <p className="text-xs text-muted-foreground">Dodaj własne reguły do tego kalkulatora.</p>
        </div>
        <Button type="button" size="sm" className="gap-1" onClick={() => setEditor(emptyCondition())}>
          <Plus className="w-3.5 h-3.5" /> Dodaj warunek
        </Button>
      </div>

      {extras.length > 0 && (
        <div className="rounded-xl border border-border/70 divide-y divide-border/50">
          {extras.map((cond) => {
            const actual = extraValues?.[cond.id];
            const met = cond.type === "boolean"
              ? Boolean(actual)
              : isConditionMet(cond, actual);
            return (
              <div key={cond.id} className={cn("flex items-center gap-2 px-2 py-2", met && "bg-primary/5")}>
                {cond.type === "boolean" ? (
                  <Checkbox
                    checked={Boolean(actual)}
                    onCheckedChange={(v) => onExtraValues({ ...extraValues, [cond.id]: Boolean(v) })}
                  />
                ) : (
                  <Checkbox checked={met} disabled />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {cond.name}
                    {cond.required ? <span className="ml-1 text-[10px] text-amber-400">REQ</span> : null}
                  </p>
                  {cond.type !== "boolean" && (
                    <div className="mt-1">{valueInput(cond, actual, (v) => onExtraValues({ ...extraValues, [cond.id]: v }))}</div>
                  )}
                </div>
                <span className={cn("tabular-nums text-xs font-semibold", pointsToneClass(cond.points))}>
                  {formatPoints(cond.points)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditor(cond)}><Pencil className="w-3.5 h-3.5" /> Edytuj</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-loss"
                      onClick={() => onExtraConditions(extras.filter((c) => c.id !== cond.id))}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Usuń
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <ConditionEditor
        open={Boolean(editor)}
        condition={editor}
        onClose={() => setEditor(null)}
        onSave={(next) => {
          const exists = extras.some((c) => c.id === next.id);
          onExtraConditions(exists ? extras.map((c) => (c.id === next.id ? next : c)) : [...extras, next]);
          setEditor(null);
        }}
      />
    </div>
  );
}
