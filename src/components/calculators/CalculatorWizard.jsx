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
import { ELEMENT_TYPES, ICON_OPTIONS, emptyCustomCalculator, emptyElement } from "@/lib/calculatorStore";
import { emptyCondition } from "@/lib/calculatorScoring";
import { Pencil, Plus, Trash2 } from "lucide-react";

const ELEMENT_TO_CONDITION = new Set(["condition", "checkbox"]);

export default function CalculatorWizard({ open, onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(emptyCustomCalculator());
  const [editEl, setEditEl] = useState(null);

  const reset = () => {
    setStep(1);
    setDraft(emptyCustomCalculator());
    setEditEl(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));

  const finish = () => {
    const conditions = [...(draft.conditions || [])];
    for (const el of draft.elements || []) {
      if (!ELEMENT_TO_CONDITION.has(el.type) && el.type !== "condition") continue;
      conditions.push(
        emptyCondition({
          name: el.name || "Warunek",
          type: el.type === "checkbox" ? "boolean" : el.type === "condition" ? "boolean" : el.type,
          points: Number(el.points) || 0,
          required: Boolean(el.required),
          timeframe: el.timeframe || "",
          description: el.description || "",
          unit: el.unit || "",
          value: el.passValue || el.defaultValue || "",
        })
      );
    }
    onCreate({
      ...draft,
      name: String(draft.name || "").trim() || "Nowy kalkulator",
      conditions,
      updatedAt: Date.now(),
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Podstawowe informacje" : "Elementy kalkulatora"}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Nazwa</span>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Opis</span>
              <Textarea value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={2} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Ikona</span>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.icon} onChange={(e) => patch({ icon: e.target.value })}>
                {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Kategoria</span>
              <Input value={draft.category} onChange={(e) => patch({ category: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Kolor akcentu</span>
              <Input type="color" value={draft.accent || "#14b8a6"} onChange={(e) => patch({ accent: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 pt-6">
              <Checkbox checked={Boolean(draft.favorite)} onCheckedChange={(v) => patch({ favorite: Boolean(v) })} />
              <span className="text-sm">Ulubiony</span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setEditEl(emptyElement("condition"))}>
              <Plus className="w-3.5 h-3.5" /> Dodaj element
            </Button>
            <ul className="space-y-2">
              {(draft.elements || []).map((el) => (
                <li key={el.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{el.name || "(bez nazwy)"}</p>
                    <p className="text-[11px] text-muted-foreground">{ELEMENT_TYPES.find((t) => t.id === el.type)?.label || el.type}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditEl(el)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => patch({ elements: draft.elements.filter((x) => x.id !== el.id) })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
              {!draft.elements?.length && <p className="text-sm text-muted-foreground">Dodaj pola, warunki, scoring albo ryzyko.</p>}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={close}>Anuluj</Button>
          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)}>Dalej</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Wstecz</Button>
              <Button type="button" onClick={finish}>Utwórz kalkulator</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <ElementEditor
        element={editEl}
        onClose={() => setEditEl(null)}
        onSave={(next) => {
          const list = draft.elements || [];
          const exists = list.some((e) => e.id === next.id);
          patch({ elements: exists ? list.map((e) => (e.id === next.id ? next : e)) : [...list, next] });
          setEditEl(null);
        }}
      />
    </Dialog>
  );
}

function ElementEditor({ element, onClose, onSave }) {
  const [draft, setDraft] = useState(element);
  useEffect(() => { setDraft(element); }, [element]);
  const open = Boolean(element);
  const current = draft || element;
  if (!open || !current) return null;

  const patch = (partial) => setDraft((prev) => ({ ...(prev || element), ...partial }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edytuj element</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Nazwa</span>
            <Input value={current.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Opis</span>
            <Textarea value={current.description || ""} onChange={(e) => patch({ description: e.target.value })} rows={2} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Typ</span>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={current.type} onChange={(e) => patch({ type: e.target.value })}>
              {ELEMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Wartość domyślna</span>
            <Input value={current.defaultValue || ""} onChange={(e) => patch({ defaultValue: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Jednostka</span>
            <Input value={current.unit || ""} onChange={(e) => patch({ unit: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <Input value={current.timeframe || ""} onChange={(e) => patch({ timeframe: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Min</span>
            <Input value={current.min || ""} onChange={(e) => patch({ min: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Max</span>
            <Input value={current.max || ""} onChange={(e) => patch({ max: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Punkty</span>
            <Input type="number" value={current.points || 0} onChange={(e) => patch({ points: Number(e.target.value) })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Warunek zaliczenia</span>
            <Input value={current.passValue || ""} onChange={(e) => patch({ passValue: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={Boolean(current.required)} onCheckedChange={(v) => patch({ required: Boolean(v) })} />
            <span className="text-sm">Wymagane</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={current.visible !== false} onCheckedChange={(v) => patch({ visible: Boolean(v) })} />
            <span className="text-sm">Widoczny</span>
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          <Button type="button" onClick={() => onSave({ ...current, name: String(current.name || "").trim() || "Element" })}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
