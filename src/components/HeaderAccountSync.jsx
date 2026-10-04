import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { getTrades, getTradingAccounts } from "@/lib/localStorage";
import { isTradingAccountActive } from "@/lib/utils";
import { importMtHistoryFile } from "@/lib/mtHistorySync";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HISTORY_ACCEPT =
  ".csv,.xml,.xlsx,.xlsm,text/csv,text/xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SELECT_CHROME_PX = 52;
const MENU_CHECK_EXTRA_PX = 28;
const SELECT_MIN_PX = 140;

function storageKey(userId) {
  return `mt_sync_account_${userId || "guest"}`;
}

function offsetBelowHeader(trigger) {
  if (!trigger) return 8;
  const triggerRect = trigger.getBoundingClientRect();
  const header = trigger.closest("header");
  const headerBottom = header?.getBoundingClientRect().bottom ?? triggerRect.bottom;
  return Math.max(8, Math.ceil(headerBottom - triggerRect.bottom) + 8);
}

function maxAvailableWidth(trigger) {
  if (typeof window === "undefined") return 360;
  const triggerLeft = trigger?.getBoundingClientRect().left ?? 240;
  return Math.max(SELECT_MIN_PX, Math.floor(window.innerWidth - triggerLeft - 24));
}

function measureAccountSelectWidth(names, trigger) {
  if (typeof document === "undefined") return SELECT_MIN_PX;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return SELECT_MIN_PX;
  ctx.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
  const textWidth = names.reduce((max, name) => {
    const width = ctx.measureText(String(name || "Konto")).width;
    return width > max ? width : max;
  }, ctx.measureText("Konto").width);
  const fitted = Math.ceil(textWidth + SELECT_CHROME_PX + 2);
  return Math.min(maxAvailableWidth(trigger), Math.max(SELECT_MIN_PX, fitted));
}

export default function HeaderAccountSync() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const triggerRef = useRef(null);
  const importLock = useRef(false);
  const [accountId, setAccountId] = useState("");
  const [importing, setImporting] = useState(false);
  const [menuOffset, setMenuOffset] = useState(8);
  const [selectWidth, setSelectWidth] = useState(SELECT_MIN_PX);
  const planActive = location.pathname.toLowerCase().includes("/dayplan");
  const planHref = `${createPageUrl("DayPlan")}?date=${todayIso()}${
    accountId ? `&account=${encodeURIComponent(accountId)}` : ""
  }`;

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user.id),
    enabled: !!user?.id,
  });

  const activeAccounts = useMemo(
    () => accounts.filter(isTradingAccountActive),
    [accounts]
  );

  const accountNames = useMemo(
    () => activeAccounts.map((account) => String(account.name || "")),
    [activeAccounts]
  );

  useEffect(() => {
    if (!user?.id || !activeAccounts.length) return;
    const saved = localStorage.getItem(storageKey(user.id));
    const stillThere = activeAccounts.some((account) => String(account.id) === String(saved));
    setAccountId(stillThere ? String(saved) : String(activeAccounts[0].id));
  }, [user?.id, activeAccounts]);

  useEffect(() => {
    const updateWidth = () => {
      setSelectWidth(measureAccountSelectWidth(accountNames, triggerRef.current));
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [accountNames]);

  const selected = activeAccounts.find((account) => String(account.id) === String(accountId));

  const chooseAccount = (value) => {
    setAccountId(value);
    if (user?.id) {
      localStorage.setItem(storageKey(user.id), value);
      window.dispatchEvent(new Event("storage"));
    }
  };

  const refreshTrades = () => {
    queryClient.invalidateQueries({ queryKey: ["trades", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["trades"] });
    queryClient.invalidateQueries({ queryKey: ["accounts", user?.id] });
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected || !user?.id || importLock.current) return;

    importLock.current = true;
    setImporting(true);
    const loading = toast.loading(`Import ${selected.name}…`);
    try {
      const existing = queryClient.getQueryData(["trades", user.id]) || (await getTrades(user.id));
      const result = await importMtHistoryFile({
        userId: user.id,
        account: selected,
        file,
        existingTrades: existing,
      });
      if (result.empty) {
        toast.error("W pliku nie ma pozycji buy/sell.", { id: loading });
        return;
      }
      if (!result.imported) {
        toast.info("Wszystkie transakcje z tego raportu są już na koncie.", { id: loading });
        return;
      }
      const skippedMsg = result.skipped > 0 ? `, pominięto ${result.skipped} duplikatów` : "";
      toast.success(`Dodano ${result.imported} transakcji do ${selected.name}${skippedMsg}`, {
        id: loading,
      });
      refreshTrades();
    } catch (err) {
      toast.error(err?.message || "Import nie powiódł się.", { id: loading });
    } finally {
      importLock.current = false;
      setImporting(false);
    }
  };

  const onImportClick = () => {
    if (importLock.current || !selected) return;
    fileRef.current?.click();
  };

  const prepareMenuOffset = () => {
    setMenuOffset(offsetBelowHeader(triggerRef.current));
    setSelectWidth(measureAccountSelectWidth(accountNames, triggerRef.current));
  };

  if (!user?.id) return null;

  const widthStyle = { width: selectWidth, minWidth: selectWidth, maxWidth: selectWidth };
  const menuWidth = Math.min(
    maxAvailableWidth(triggerRef.current),
    selectWidth + MENU_CHECK_EXTRA_PX
  );
  const menuWidthStyle = { width: menuWidth, minWidth: menuWidth, maxWidth: menuWidth };

  return (
    <div className="header-cluster flex h-8 items-center gap-0.5">
      <Select
        value={accountId || undefined}
        onValueChange={chooseAccount}
        onOpenChange={(open) => {
          if (open) prepareMenuOffset();
        }}
        disabled={!activeAccounts.length || importing}
      >
        <SelectTrigger
          ref={triggerRef}
          aria-label="Konto do importu"
          onPointerDown={prepareMenuOffset}
          style={widthStyle}
          className="h-7 shrink-0 justify-start border-0 bg-transparent px-2 pr-7 text-left text-[12px] font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-none [&>span]:w-auto [&>span]:max-w-none [&>span]:flex-1 [&>span]:overflow-visible [&>span]:whitespace-nowrap [&>span]:pr-0 [&>span]:text-left"
        >
          <SelectValue placeholder="Konto" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="start"
          sideOffset={menuOffset}
          avoidCollisions={false}
          style={menuWidthStyle}
          className="z-[300] box-border overflow-hidden"
        >
          {activeAccounts.map((account) => (
            <SelectItem
              key={account.id}
              value={String(account.id)}
              className="gap-2 px-2 py-1.5 [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:overflow-visible [&>span:first-child]:whitespace-nowrap [&>span:first-child]:text-clip"
            >
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="header-cluster-sep" aria-hidden />
      <Button
        asChild
        type="button"
        variant="ghost"
        title={t("dayPlan") || "Plan dnia"}
        aria-label={t("dayPlan") || "Plan dnia"}
        aria-current={planActive ? "page" : undefined}
        className={`h-7 gap-1.5 px-2.5 text-[12px] font-mono hover:bg-white/5 ${
          planActive ? "bg-white/5 text-primary" : "text-foreground"
        }`}
      >
        <Link to={planHref}>
          <CalendarCheck2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{t("dayPlan") || "Plan dnia"}</span>
        </Link>
      </Button>
      <span className="header-cluster-sep" aria-hidden />
      <input
        ref={fileRef}
        type="file"
        accept={HISTORY_ACCEPT}
        className="sr-only"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="ghost"
        disabled={!selected || importing}
        onClick={onImportClick}
        title="Szybki import transakcji CSV/XML/XLSX na wybrane konto"
        className="h-7 gap-1.5 px-2.5 text-[12px] font-mono text-foreground hover:bg-white/5"
      >
        <Upload className={`h-3.5 w-3.5 ${importing ? "animate-pulse" : ""}`} />
        {importing ? "Importowanie..." : "Import"}
      </Button>
    </div>
  );
}
