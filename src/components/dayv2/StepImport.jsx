// Krok 3 — Import: wywołuje ISTNIEJĄCY import historii MT5 (importMtHistoryFile, bez zmian logiki),
// pokazuje wynik i tabelę transakcji dnia z wyborem setupu i oceną dyscypliny.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { getTrades, updateTrade } from "@/lib/localStorage";
import { importMtHistoryFile } from "@/lib/mtHistorySync";
import ImportResultDialog from "@/components/ImportResultDialog";
import { fmtMoney, fmtR } from "@/lib/dayFlow";
import { discColor } from "./parts";

const HISTORY_ACCEPT =
  ".csv,.xml,.xlsx,.xlsm,text/csv,text/xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function TradeTable({ views, strategies, editable, onSetup, onRating }) {
  const nameOf = (id) => strategies.find((s) => String(s.id) === String(id))?.name || "";
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Godz.</th>
          <th>Para</th>
          <th>Kier.</th>
          <th>Setup</th>
          <th className="r">R</th>
          <th className="r">Netto</th>
          <th className="r">Dyscyplina</th>
        </tr>
      </thead>
      <tbody>
        {views.map((v) => (
          <tr key={v.id}>
            <td className="mono">{v.time}</td>
            <td className="mono">{v.symbol}</td>
            <td>
              <span className={`dir ${v.dir}`}>{v.dir === "L" ? "LONG" : "SHORT"}</span>
            </td>
            <td>
              {editable ? (
                <select className="inp" value={v.strategyId} onChange={(e) => onSetup(v, e.target.value)} aria-label={`Setup ${v.time} ${v.symbol}`}>
                  <option value="">Wybierz setup…</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                nameOf(v.strategyId) || <span className="mut">—</span>
              )}
            </td>
            <td className={`r mono ${(v.r ?? 0) >= 0 ? "pos" : "neg"}`}>{fmtR(v.r)}</td>
            <td className={`r mono ${(v.net ?? 0) >= 0 ? "pos" : "neg"}`}>{fmtMoney(v.net)}</td>
            <td className="r">
              {editable ? (
                <button
                  type="button"
                  className="disc"
                  title="Kliknij, żeby zmienić ocenę (1–5)"
                  aria-label={`Ocena dyscypliny ${v.rating ?? "brak"}, zmień`}
                  style={{ color: discColor(v.rating), borderColor: discColor(v.rating) }}
                  onClick={() => onRating(v, v.rating == null ? 5 : v.rating >= 5 ? 1 : v.rating + 1)}
                >
                  {v.rating ?? "–"}
                </button>
              ) : (
                <span className="disc" style={{ color: discColor(v.rating), borderColor: discColor(v.rating) }}>
                  {v.rating ?? "–"}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StepImport({ user, account, doc, views, strategies, onImportDone, onGo }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const importedAt = doc?.import_done_at ? new Date(doc.import_done_at) : null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trades", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["trades"] });
    queryClient.invalidateQueries({ queryKey: ["accounts", user?.id] });
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !account || !user?.id || lock.current) return;
    lock.current = true;
    setBusy(true);
    const loading = toast.loading(`Import ${account.name}…`);
    try {
      const existing = queryClient.getQueryData(["trades", user.id]) || (await getTrades(user.id));
      const res = await importMtHistoryFile({ userId: user.id, account, file, existingTrades: existing });
      setResult({ imported: res.imported || 0, skipped: res.skipped, empty: !!res.empty, fileName: file.name, accountName: account.name });
      if (res.imported) refresh();
      onImportDone();
    } catch (err) {
      setResult({ fileName: file.name, accountName: account.name, errorMessage: err?.message || "Import nie powiódł się." });
    } finally {
      toast.dismiss(loading);
      lock.current = false;
      setBusy(false);
    }
  };

  const saveTrade = async (v, data, okMsg) => {
    try {
      await updateTrade(user.id, v.id, data);
      refresh();
      if (okMsg) toast.success(okMsg);
    } catch (err) {
      toast.error(err?.message || "Nie udało się zapisać transakcji.");
    }
  };

  const withSetup = views.filter((v) => v.strategyId).length;
  return (
    <section className="dz-col" aria-label="Import">
      <div className="card">
        <div className="imp">
          <span className="src">MT5</span>
          <div className="meta">
            <b>{views.length ? `Transakcje z dnia: ${views.length}` : "Pobierz dzisiejsze transakcje z MT5"}</b>
            <span>
              {account ? `${account.name}` : "Wybierz konto"}
              {importedAt ? ` · ostatni import ${importedAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : ""}
              {" · plik z historią konta (CSV / XML / XLSX). Duplikaty są pomijane."}
            </span>
          </div>
          <button type="button" className={`btn${views.length ? "" : " pri"}`} disabled={busy || !account} onClick={() => fileRef.current?.click()}>
            <Upload className="ico" />
            {busy ? "Importuję…" : views.length ? "Importuj ponownie" : "Importuj z MT5"}
          </button>
          <input ref={fileRef} type="file" accept={HISTORY_ACCEPT} className="sr-only" onChange={onFile} />
        </div>
        {!views.length && !doc?.import_done_at ? (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn sm" onClick={onImportDone}>
              Dziś nie było transakcji
            </button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="ch">
          <h2>Transakcje dnia</h2>
          <span className="h">
            {views.length ? `${withSetup}/${views.length} z setupem · ` : ""}Przypisz setup i oceń dyscyplinę każdej transakcji
          </span>
        </div>
        {views.length ? (
          <div className="tw">
            <TradeTable
              views={views}
              strategies={strategies}
              editable
              onSetup={(v, id) => saveTrade(v, { strategy_id: id || "" })}
              onRating={(v, rating) => saveTrade(v, { discipline_rating: rating })}
            />
          </div>
        ) : (
          <div className="muted-empty">Po imporcie zobaczysz tu transakcje z dnia i przypiszesz im setup.</div>
        )}
        {!strategies.length && views.length ? (
          <div className="muted-empty" style={{ marginTop: 10 }}>
            Nie masz jeszcze strategii — dodaj je w zakładce Strategie, żeby wybierać setup.
          </div>
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => onGo(1)}>
          Wróć do handlu
        </button>
        <button type="button" className="btn pri" onClick={() => onGo(3)}>
          Dalej: przegląd dnia
        </button>
      </div>

      <ImportResultDialog
        open={Boolean(result)}
        onOpenChange={(next) => {
          if (!next) setResult(null);
        }}
        imported={result?.imported}
        skipped={result?.skipped}
        empty={result?.empty}
        fileName={result?.fileName}
        accountName={result?.accountName}
        errorMessage={result?.errorMessage}
      />
    </section>
  );
}
