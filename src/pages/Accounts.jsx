import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getTradingAccounts, createTradingAccount, deleteTradingAccount, updateTradingAccount, getTrades } from "@/lib/localStorage";
import { getTradeRealizedPL, isClosedTrade } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash, Wallet, Power } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AccountImportButton } from "@/components/AccountImportExport";
import MtAccountLink from "@/components/MtAccountLink";
import QuoteLine from "@/components/QuoteLine";
import { SkeletonCardGrid } from "@/components/ui/skeleton-block";
import { usePnlDisplay } from "@/hooks/use-pnl-display";

export default function Accounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [accountVisibilityFilter, setAccountVisibilityFilter] = useState('all');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => (user ? getTradingAccounts(user.id) : []),
    enabled: !!user
  });

  const { data: trades = [], isLoading: isTradesLoading } = useQuery({
    queryKey: ['trades', user?.id],
    queryFn: () => (user ? getTrades(user.id) : []),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!user) throw new Error('Użytkownik nie jest zalogowany');
      return createTradingAccount(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      setShowForm(false);
      toast.success('Konto zostało utworzone pomyślnie');
    },
    onError: (error) => {
      console.error('Error creating account:', error);
      toast.error('Wystąpił błąd podczas tworzenia konta');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!user) throw new Error('Użytkownik nie jest zalogowany');
      return updateTradingAccount(user.id, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      setShowForm(false);
      setEditingAccount(null);
      toast.success('Konto zostało zaktualizowane pomyślnie');
    },
    onError: (error) => {
      console.error('Error updating account:', error);
      toast.error('Wystąpił błąd podczas aktualizacji konta');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId) => {
      if (!user) throw new Error('Użytkownik nie jest zalogowany');
      return deleteTradingAccount(user.id, accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      setDeletingAccount(null);
      toast.success('Konto zostało usunięte pomyślnie');
    },
    onError: (error) => {
      console.error('Error deleting account:', error);
      toast.error('Wystąpił błąd podczas usuwania konta');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => {
      if (!user) throw new Error('Użytkownik nie jest zalogowany');
      return updateTradingAccount(user.id, id, {
        is_active: isActive,
        status: isActive ? 'Active' : 'Inactive'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Dostępność konta została zaktualizowana');
    },
    onError: (error) => {
      console.error('Error toggling account active state:', error);
      toast.error('Nie udało się zmienić dostępności konta');
    }
  });


  if (!user) {
    return (
      <div className="w-full min-h-[40vh] dashboard-surface p-6">
        <div className="max-w-none mx-0 space-y-3">
          <div className="text-center">
            <h1 className="cyber-page-title mb-4">Wymagane logowanie</h1>
            <p className="cyber-page-sub">Musisz się zalogować, aby zarządzać kontami handlowymi.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isTradesLoading) {
    return (
      <div className="w-full min-h-[40vh] dashboard-surface space-y-3">
        <div className="space-y-1.5">
          <h1 className="cyber-page-title">Konta tradingowe</h1>
          <p className="cyber-page-sub">Ładowanie kont…</p>
        </div>
        <SkeletonCardGrid count={3} />
      </div>
    );
  }

  const isAccountActive = (account) => account.is_active !== false && account.status !== 'Inactive';
  const visibleAccounts = accounts.filter((account) => {
    if (accountVisibilityFilter === 'active') return isAccountActive(account);
    if (accountVisibilityFilter === 'inactive') return !isAccountActive(account);
    return true;
  });

  return (
    <div className="w-full min-h-0 dashboard-surface space-y-3">
      <div className="max-w-none mx-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="cyber-page-title">Konta tradingowe</h1>
            <p className="cyber-page-sub">Zarządzaj swoimi kontami handlowymi</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <QuoteLine className="hidden lg:flex shrink-0" />
            <Select value={accountVisibilityFilter} onValueChange={setAccountVisibilityFilter}>
              <SelectTrigger className="w-[190px] bg-card border-border">
                <SelectValue placeholder="Filtr kont" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pokaż wszystkie</SelectItem>
                <SelectItem value="active">Pokaż tylko aktywne</SelectItem>
                <SelectItem value="inactive">Pokaż tylko nieaktywne</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open);
              if (!open) setEditingAccount(null);
            }}>
              <DialogTrigger asChild>
                <Button className="cyber-primary-btn gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" />
                  Dodaj konto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingAccount ? 'Edytuj konto' : 'Dodaj nowe konto'}</DialogTitle>
                </DialogHeader>
                <AccountForm
                  account={editingAccount}
                  onSubmit={(data) => {
                    if (editingAccount) {
                      updateMutation.mutate({ id: editingAccount.id, data });
                    } else {
                      createMutation.mutate(data);
                    }
                  }}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingAccount(null);
                  }}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Brak kont handlowych</h3>
            <p className="text-muted-foreground mb-6 text-sm">Rozpocznij od dodania pierwszego konta tradingowego.</p>
            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open);
              if (!open) setEditingAccount(null);
            }}>
              <DialogTrigger asChild>
                <Button className="cyber-primary-btn gap-2">
                  <Plus className="w-4 h-4" />
                  Dodaj pierwsze konto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Dodaj nowe konto</DialogTitle>
                </DialogHeader>
                <AccountForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  onCancel={() => setShowForm(false)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Brak kont w tym filtrze</h3>
            <p className="text-muted-foreground mb-6 text-sm">Zmień filtr na „Pokaż wszystkie” lub aktywuj konto przełącznikiem.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {visibleAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                trades={trades}
                user={user}
                queryClient={queryClient}
                onEdit={(account) => {
                  setEditingAccount(account);
                  setShowForm(true);
                }}
                onDelete={(account) => setDeletingAccount(account)}
                onToggleActive={(account, nextActive) => {
                  toggleActiveMutation.mutate({ id: account.id, isActive: nextActive });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAccount} onOpenChange={() => setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń konto</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć konto "{deletingAccount?.name}"? Ta akcja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
              className="bg-loss text-white hover:bg-loss/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountCard({ account, trades, user, queryClient, onEdit, onDelete, onToggleActive }) {
  const pnl = usePnlDisplay();
  const accountTypeColors = {
    Live: "var(--ds-pos)",
    Demo: "var(--ds-text2)",
    Challenge: "var(--ds-warn)",
    Funded: "var(--ds-warn)"
  };
  const initialBalance = parseFloat(account.initial_balance) || 0;
  const currentBalance = parseFloat(account.current_balance);
  const accentColor = account.color || accountTypeColors[account.account_type] || "var(--ds-text2)";
  const isAccountActive = account.is_active !== false && account.status !== 'Inactive';

  const accountTrades = trades.filter(
    (trade) => String(trade.account_id) === String(account.id) && isClosedTrade(trade)
  );
  const realizedPL = accountTrades.reduce((sum, trade) => sum + (getTradeRealizedPL(trade) ?? 0), 0);
  const balanceBasedPL = Number.isFinite(currentBalance) ? currentBalance - initialBalance : 0;
  const profitLoss = accountTrades.length > 0 ? realizedPL : balanceBasedPL;
  const displayedBalance = Number.isFinite(currentBalance) ? currentBalance : initialBalance + realizedPL;
  const profitLossPercent = initialBalance > 0 ? ((profitLoss / initialBalance) * 100).toFixed(2) : 0;
  const totalTrades = accountTrades.length;
  const winningTrades = accountTrades.filter((trade) => trade.outcome === "Win").length;
  const losingTrades = accountTrades.filter((trade) => trade.outcome === "Loss").length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0;
  const winPLs = accountTrades
    .filter((trade) => trade.outcome === "Win")
    .map((trade) => getTradeRealizedPL(trade) ?? 0);
  const lossPLs = accountTrades
    .filter((trade) => trade.outcome === "Loss")
    .map((trade) => getTradeRealizedPL(trade) ?? 0);
  const avgWin = winPLs.length ? winPLs.reduce((sum, pl) => sum + pl, 0) / winPLs.length : 0;
  const avgLoss = lossPLs.length ? lossPLs.reduce((sum, pl) => sum + pl, 0) / lossPLs.length : 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-profit';
      case 'Inactive': return 'text-muted-foreground';
      case 'Suspended': return 'text-warning';
      case 'Closed': return 'text-loss';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Active': return 'Aktywne';
      case 'Inactive': return 'Nieaktywne';
      case 'Suspended': return 'Zawieszone';
      case 'Closed': return 'Zamknięte';
      default: return status;
    }
  };

  const getAccountTypeColor = () => {
    return "bg-card border border-border";
  };

  const getAccountDividerColor = () => {
    return 'border-border';
  };

  const getAccountTypeBadge = () => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch (account.account_type) {
      case 'Live':
        return <Badge className={`${baseClasses} bg-profit/10 text-profit dark:bg-profit/10`}>Live</Badge>;
      case 'Demo':
        return <Badge className={`${baseClasses} bg-muted text-foreground`}>Demo</Badge>;
      case 'Challenge':
        return <Badge className={`${baseClasses} bg-warning/10 text-warning`}>Challenge</Badge>;
      case 'Funded':
        return <Badge className={`${baseClasses} bg-warning/10 text-warning`}>Funded</Badge>;
      default:
        return <Badge className={`${baseClasses} bg-muted text-foreground`}>{account.account_type}</Badge>;
    }
  };

  return (
    <Card className={`transition-colors duration-200 ${getAccountTypeColor()} ${isAccountActive ? '' : 'opacity-75'}`} style={{ borderLeftColor: accentColor }}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          <div className="order-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} aria-hidden="true" />
              <CardTitle className="min-w-0 truncate text-[18px] font-semibold" title={account.name}>{account.name}</CardTitle>
              <MtAccountLink
                account={account}
                userId={user?.id}
                existingTrades={trades}
                onChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ["accounts", user?.id] });
                  queryClient.invalidateQueries({ queryKey: ["trades", user?.id] });
                  queryClient.invalidateQueries({ queryKey: ["trades"] });
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ds-text2">
              {account.broker && <span className="truncate">{account.broker}</span>}
              {account.account_number && <span className="truncate">Nr: {account.account_number}</span>}
              {account.status && !['Active', 'Inactive'].includes(account.status) && (
                <span className={`${getStatusColor(account.status)} whitespace-nowrap`}>{getStatusText(account.status)}</span>
              )}
              <span className={`whitespace-nowrap ${isAccountActive ? 'text-ds-pos' : 'text-ds-text3'}`}>
                {isAccountActive ? 'Aktywne' : 'Nieaktywne'}
              </span>
            </div>
          </div>
          <div className="order-1 flex items-center justify-between gap-2">
            {getAccountTypeBadge()}
          <div className="flex gap-1 flex-shrink-0">
            <AccountImportButton
              account={account}
              existingTrades={trades}
              onImportSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
                queryClient.invalidateQueries({ queryKey: ['trades'] });
                queryClient.refetchQueries({ queryKey: ['trades', user?.id] });
              }}
            />
            <Button size="sm" variant="outline" onClick={() => onEdit(account)} className="h-8 w-8 p-0" aria-label={`Edytuj konto ${account.name}`} title="Edytuj">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(account)} className="h-8 w-8 p-0 text-ds-neg hover:text-ds-neg" aria-label={`Usuń konto ${account.name}`} title="Usuń">
              <Trash className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggleActive(account, !isAccountActive)}
              aria-pressed={isAccountActive}
              aria-label={isAccountActive ? `Wyłącz konto ${account.name}` : `Włącz konto ${account.name}`}
              title={isAccountActive ? "Wyłącz konto" : "Włącz konto"}
              className={`h-8 w-8 p-0 ${isAccountActive ? "text-profit" : "text-muted-foreground"}`}
            >
              <Power className="w-3.5 h-3.5" />
            </Button>
          </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Kapitał</span>
            <div className="text-[20px] font-semibold tabular-nums">{displayedBalance.toFixed(2)} {account.currency}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">P&L</span>
            <div className={`text-[20px] font-semibold tabular-nums ${profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
              {pnl.mode === "percent"
                ? `${Number(profitLossPercent) > 0 ? "+" : ""}${profitLossPercent}%`
                : `${profitLoss >= 0 ? "+" : ""}${Number(profitLoss || 0).toFixed(2)} ${account.currency || ""}`}
            </div>
          </div>
        </div>

        {/* Statystyki */}
        <div className={`pt-3 border-t ${getAccountDividerColor()}`}>
          <div className="grid grid-cols-3 gap-x-3 gap-y-3 text-[13px]">
            <div className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Transakcje</span>
              <div className="font-semibold mt-0.5">{totalTrades}</div>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Win Rate</span>
              <div className="font-semibold mt-0.5 text-profit">{winRate}%</div>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">W/L Ratio</span>
              <div className="font-semibold mt-0.5">{winningTrades}:{losingTrades}</div>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Śr. zysk</span>
              <div className="font-semibold mt-0.5 text-profit">
                {pnl.mode === "percent"
                  ? (initialBalance > 0 ? `${avgWin >= 0 ? "+" : ""}${((avgWin / initialBalance) * 100).toFixed(2)}%` : "—")
                  : `${avgWin >= 0 ? "+" : ""}${avgWin.toFixed(2)} ${account.currency || ""}`}
              </div>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Śr. strata</span>
              <div className="font-semibold mt-0.5 text-loss">
                {pnl.mode === "percent"
                  ? (initialBalance > 0 ? `${((avgLoss / initialBalance) * 100).toFixed(2)}%` : "—")
                  : `${avgLoss.toFixed(2)} ${account.currency || ""}`}
              </div>
            </div>
          </div>
        </div>

        {(account.max_daily_loss_percent || account.max_account_loss || account.profit_target) && (
          <div className={`pt-3 border-t ${getAccountDividerColor()}`}>
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              {account.max_daily_loss_percent && (
                <div className="min-w-0">
                  <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Max strata</span>
                  <div className="font-semibold mt-0.5">{account.max_daily_loss_percent}%</div>
                </div>
              )}
              {account.max_account_loss && (
                <div className="min-w-0">
                  <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Limit konta</span>
                  <div className="font-semibold mt-0.5">{account.max_account_loss}%</div>
                </div>
              )}
              {account.profit_target && (
                <div className="min-w-0">
                  <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ds-text3">Cel zysku</span>
                  <div className="font-semibold mt-0.5 text-profit">{account.profit_target}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {account.notes && (
          <div className={`pt-3 border-t ${getAccountDividerColor()}`}>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{account.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountForm({ account, onSubmit, onCancel, isLoading }) {
  const accountTypeColors = {
    Live: "#7DDC6B",
    Demo: "#9099B2",
    Challenge: "#E6B83A",
    Funded: "hsl(var(--warning))"
  };
  const [formData, setFormData] = useState(account || {
    name: '',
    broker: '',
    account_number: '',
    account_type: 'Demo',
    initial_balance: '',
    currency: 'USD',
    current_balance: '',
    max_daily_loss_percent: '',
    max_account_loss: '',
    status: 'Active',
    is_active: true,
    profit_target: '',
    notes: '',
    color: accountTypeColors.Demo
  });

  // Reset form when account changes (for editing) or when not editing (for new account)
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        broker: account.broker || '',
        account_number: account.account_number || '',
        account_type: account.account_type || 'Demo',
        initial_balance: account.initial_balance?.toString() || '',
        currency: account.currency || 'USD',
        current_balance: account.current_balance?.toString() || '',
        max_daily_loss_percent: account.max_daily_loss_percent?.toString() || '',
        max_account_loss: account.max_account_loss?.toString() || '',
        status: account.status || 'Active',
        is_active: account.is_active !== false,
        profit_target: account.profit_target?.toString() || '',
        notes: account.notes || '',
        color: account.color || accountTypeColors[account.account_type] || accountTypeColors.Demo
      });
    } else {
      // Reset to empty form for new account
      setFormData({
        name: '',
        broker: '',
        account_number: '',
        account_type: 'Demo',
        initial_balance: '',
        currency: 'USD',
        current_balance: '',
        max_daily_loss_percent: '',
        max_account_loss: '',
        status: 'Active',
        is_active: true,
        profit_target: '',
        notes: '',
        color: accountTypeColors.Demo
      });
    }
  }, [account]);

  const handleAccountTypeChange = (value) => {
    const previousTypeColor = accountTypeColors[formData.account_type];
    const nextTypeColor = accountTypeColors[value] || formData.color;
    const nextColor = !formData.color || formData.color === previousTypeColor ? nextTypeColor : formData.color;
    setFormData({ ...formData, account_type: value, color: nextColor });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name.trim()) {
      toast.error('Nazwa konta jest wymagana');
      return;
    }

    if (!formData.initial_balance || isNaN(formData.initial_balance)) {
      toast.error('Kapitał początkowy jest wymagany i musi być liczbą');
      return;
    }

    const submitData = {
      ...formData,
      initial_balance: parseFloat(formData.initial_balance),
      current_balance: formData.current_balance ? parseFloat(formData.current_balance) : parseFloat(formData.initial_balance),
      max_daily_loss_percent: formData.max_daily_loss_percent ? parseFloat(formData.max_daily_loss_percent) : null,
      max_account_loss: formData.max_account_loss ? parseFloat(formData.max_account_loss) : null,
      profit_target: formData.profit_target ? parseFloat(formData.profit_target) : null
    };

    onSubmit(submitData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle>{account ? "Edytuj konto" : "Nowe konto"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nazwa konta *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="np. Demo Account"
                />
              </div>

              <div>
                <Label>Broker</Label>
                <Input
                  value={formData.broker}
                  onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                  placeholder="np. Demo Broker"
                />
              </div>

              <div>
                <Label>Numer konta</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="np. 12345678"
                />
              </div>

              <div>
                <Label>Typ konta</Label>
                <Select value={formData.account_type} onValueChange={handleAccountTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Demo">Demo</SelectItem>
                    <SelectItem value="Live">Live</SelectItem>
                    <SelectItem value="Challenge">Challenge</SelectItem>
                    <SelectItem value="Funded">Funded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kapitał początkowy *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                  placeholder="10000"
                  required
                />
              </div>

              <div>
                <Label>Waluta *</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="PLN">PLN</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Saldo aktualne</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  placeholder="Zostaw puste aby użyć kapitału początkowego"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Aktywne</SelectItem>
                    <SelectItem value="Inactive">Nieaktywne</SelectItem>
                    <SelectItem value="Suspended">Zawieszone</SelectItem>
                    <SelectItem value="Closed">Zamknięte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kolor konta</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              <div>
                <Label>Max dzienna strata (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_daily_loss_percent}
                  onChange={(e) => setFormData({ ...formData, max_daily_loss_percent: e.target.value })}
                  placeholder="np. 5.00"
                />
              </div>

              <div>
                <Label>Max strata na konto (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_account_loss}
                  onChange={(e) => setFormData({ ...formData, max_account_loss: e.target.value })}
                  placeholder="np. 10.00"
                />
              </div>

              <div>
                <Label>Cel zysk konta</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.profit_target}
                  onChange={(e) => setFormData({ ...formData, profit_target: e.target.value })}
                  placeholder="np. 2000"
                />
              </div>
            </div>

            <div>
              <Label>Notatki</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Dodatkowe informacje..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (account ? 'Aktualizowanie...' : 'Dodawanie...') : (account ? 'Zapisz zmiany' : 'Dodaj konto')}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Anuluj
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}