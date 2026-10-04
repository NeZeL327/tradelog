// Real MT5 connect only. Password stays in this form until the request finishes.
import { useState } from "react";
import { Cable } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectMt5Account } from "@/lib/mt5Connection";

function formFromAccount(account) {
  return {
    platform: "MT5",
    login: account?.mtIntegration?.mt5Login || "",
    server: account?.mtIntegration?.server || "",
  };
}

export default function MtAccountLink({ account, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFromAccount(account));
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  const integration = account?.mtIntegration;
  const connected = integration?.platform === "mt5" && integration?.status === "connected";

  const openDialog = () => {
    setForm(formFromAccount(account));
    setPassword("");
    setOpen(true);
  };

  const connect = async () => {
    if (form.platform !== "MT5") return;
    const login = form.login.trim();
    const server = form.server.trim();
    if (!/^\d{3,20}$/.test(login)) {
      toast.error("Login MT5 musi składać się z cyfr.");
      return;
    }
    if (!server) {
      toast.error("Podaj nazwę serwera MT5.");
      return;
    }
    if (password.trim().length < 4) {
      toast.error("Podaj hasło inwestora MT5.");
      return;
    }

    setConnecting(true);
    try {
      await connectMt5Account({
        accountId: account.id,
        login,
        server,
        password,
      });
      toast.success("MT5 — Połączono");
      onChanged?.();
    } catch (error) {
      const message = String(error?.message || "Nie udało się połączyć z MT5.")
        .replace(/^FirebaseError:\s*/i, "");
      toast.error(message);
      onChanged?.();
    } finally {
      setPassword("");
      setConnecting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title={connected ? "MT5 — Połączono" : "Integruj z MT5/MT4"}
        aria-label={`Integruj ${account.name} z MT5`}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors ${
          connected
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-primary"
        }`}
      >
        <Cable className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPassword(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Integruj z MT5/MT4 — {account.name}</DialogTitle>
            <DialogDescription>
              Hasło inwestora jest przekazywane do MetaApi i nie jest zapisywane w AiKeepTrade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {["MT5", "MT4"].map((platform) => (
                <button
                  key={platform}
                  type="button"
                  disabled={connecting}
                  onClick={() => setForm((prev) => ({ ...prev, platform }))}
                  className={`h-8 rounded-md border text-[12px] font-mono ${
                    form.platform === platform
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>

            {form.platform === "MT4" ? (
              <p className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground">
                MT4 — w przygotowaniu
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>MT5 Login</Label>
                  <Input
                    value={form.login}
                    onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
                    autoComplete="off"
                    inputMode="numeric"
                    disabled={connecting}
                    placeholder="14101942"
                  />
                </div>
                <div className="space-y-1">
                  <Label>MT5 Server</Label>
                  <Input
                    value={form.server}
                    onChange={(event) => setForm((prev) => ({ ...prev, server: event.target.value }))}
                    autoComplete="off"
                    disabled={connecting}
                    placeholder="Nazwa serwera z terminala"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Investor Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={connecting}
                  />
                </div>
                <Button type="button" className="w-full" onClick={connect} disabled={connecting}>
                  {connecting ? "Łączenie..." : "Połącz z MT5"}
                </Button>
              </>
            )}

            {integration?.status === "connected" && (
              <div className="rounded-md border border-profit/30 bg-profit/10 px-3 py-2 text-[12px] font-mono text-profit">
                <p>MT5 — Połączono</p>
                <p>Login: {integration.mt5Login}</p>
                <p>Server: {integration.server}</p>
                <p>Status: Połączono</p>
              </div>
            )}

            {integration?.status === "error" && (
              <div className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-[12px]">
                <p className="font-mono text-loss">MT5 — Niepołączono</p>
                {integration.lastError && (
                  <p className="mt-1 text-muted-foreground">{integration.lastError}</p>
                )}
              </div>
            )}

            {integration?.status === "pending" && !connecting && (
              <p className="text-[12px] text-muted-foreground">Łączenie z brokerem nie zostało jeszcze potwierdzone.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
