import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getTradingAccounts, createTradingAccount, deleteTradingAccount, updateTradingAccount } from "@/lib/localStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash, Wallet, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AccountImportButton } from "@/components/AccountImportExport";

export default function Accounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => {
      console.log('Fetching accounts for user:', user?.id);
      return user ? getTradingAccounts(user.id) : [];
    },
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      console.log('Creating account with data:', data);
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
      console.log('Updating account:', id, data);
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
      console.log('Deleting account:', accountId);
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


  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Wymagane logowanie</h1>
            <p className="text-slate-600 dark:text-slate-400">Musisz się zalogować, aby zarządzać kontami handlowymi.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-600 dark:text-slate-400 mt-4">Ładowanie kont...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Konta tradingowe</h1>
            <p className="text-slate-600 dark:text-slate-400">Zarządzaj swoimi kontami handlowymi</p>
          </div>
          <Dialog open={showForm} onOpenChange={(open) => {
            setShowForm(open);
            if (!open) setEditingAccount(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-5 h-5 mr-2" />
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

        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Brak kont handlowych</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Rozpocznij od dodania pierwszego konta tradingowego.</p>
            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open);
              if (!open) setEditingAccount(null);
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-5 h-5 mr-2" />
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                user={user}
                queryClient={queryClient}
                onEdit={(account) => {
                  setEditingAccount(account);
                  setShowForm(true);
                }}
                onDelete={(account) => setDeletingAccount(account)}
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
              className="bg-red-600 hover:bg-red-700"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountCard({ account, user, queryClient, onEdit, onDelete }) {
  const accountTypeColors = {
    Live: "#10b981",
    Demo: "#3b82f6",
    Challenge: "#8b5cf6",
    Funded: "#f59e0b"
  };
  const profitLoss = account.current_balance - account.initial_balance;
  const profitLossPercent = account.initial_balance > 0 ? ((profitLoss / account.initial_balance) * 100).toFixed(2) : 0;
  const accentColor = account.color || accountTypeColors[account.account_type] || "#64748b";

  // Oblicz statystyki (na razie przykładowe, później połączymy z transakcjami)
  const totalTrades = 0; // TODO: pobrać z transakcji
  const winningTrades = 0; // TODO: pobrać z transakcji
  const losingTrades = 0; // TODO: pobrać z transakcji
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0;
  const avgWin = 0; // TODO: obliczyć średni zysk
  const avgLoss = 0; // TODO: obliczyć średnią stratę

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600';
      case 'Inactive': return 'text-gray-500';
      case 'Suspended': return 'text-yellow-600';
      case 'Closed': return 'text-red-600';
      default: return 'text-gray-500';
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
    return "border-l-4 bg-white/80 dark:bg-[#14141f]/80 backdrop-blur border border-slate-200/60 dark:border-[#2d2d40] shadow-lg hover:shadow-xl";
  };

  const getAccountDividerColor = () => {
    return 'border-slate-200/60 dark:border-[#2d2d40]';
  };

  const getAccountTypeBadge = () => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch (account.account_type) {
      case 'Live':
        return <Badge className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>Live</Badge>;
      case 'Demo':
        return <Badge className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>Demo</Badge>;
      case 'Challenge':
        return <Badge className={`${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`}>Challenge</Badge>;
      case 'Funded':
        return <Badge className={`${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`}>Funded</Badge>;
      default:
        return <Badge className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`}>{account.account_type}</Badge>;
    }
  };

  return (
    <Card className={`transition-all ${getAccountTypeColor()}`} style={{ borderLeftColor: accentColor }}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getAccountTypeBadge()}
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
            <CardTitle className="text-lg">{account.name}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mt-1">
              {account.broker && <span>{account.broker}</span>}
              {account.account_number && <span>Nr: {account.account_number}</span>}
              <span className={getStatusColor(account.status)}>{getStatusText(account.status)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <AccountImportButton 
              account={account} 
              onImportSuccess={() => {
                // Invalidate queries to refresh data
                queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
                toast.success('Transakcje zaimportowane pomyślnie');
              }} 
            />
            <Button size="sm" variant="outline" onClick={() => onEdit(account)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(account)} className="text-red-600 hover:text-red-700">
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Kapitał:</span>
            <div className="font-medium">{account.current_balance?.toFixed(2)} {account.currency}</div>
          </div>
          <div>
            <span className="text-sm text-slate-600 dark:text-slate-400">P&L:</span>
            <div className={`font-medium ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitLoss >= 0 ? '+' : ''}{profitLoss?.toFixed(2)} {account.currency} ({profitLossPercent}%)
            </div>
          </div>
        </div>

        {/* Statystyki */}
        <div className={`pt-3 border-t dark:border-slate-700 ${getAccountDividerColor()}`}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Transakcje:</span>
              <div className="font-medium">{totalTrades}</div>
            </div>
            <div>
              <span className="text-slate-500">Win Rate:</span>
              <div className="font-medium text-green-600">{winRate}%</div>
            </div>
            <div>
              <span className="text-slate-500">W/L Ratio:</span>
              <div className="font-medium">{winningTrades}:{losingTrades}</div>
            </div>
          </div>
        </div>

        {(account.max_daily_loss_percent || account.max_account_loss || account.profit_target) && (
          <div className={`pt-3 border-t dark:border-slate-700 ${getAccountDividerColor()}`}>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {account.max_daily_loss_percent && (
                <div>
                  <span className="text-slate-500">Max strata dziennie:</span>
                  <div className="font-medium">{account.max_daily_loss_percent}%</div>
                </div>
              )}
              {account.max_account_loss && (
                <div>
                  <span className="text-slate-500">Max strata konto:</span>
                  <div className="font-medium">{account.max_account_loss}%</div>
                </div>
              )}
              {account.profit_target && (
                <div>
                  <span className="text-slate-500">Cel zysku:</span>
                  <div className="font-medium text-green-600">{account.profit_target} {account.currency}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {account.notes && (
          <div className={`pt-3 border-t dark:border-slate-700 ${getAccountDividerColor()}`}>
            <p className="text-sm text-slate-600 dark:text-slate-400">{account.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountForm({ account, onSubmit, onCancel, isLoading }) {
  const accountTypeColors = {
    Live: "#10b981",
    Demo: "#3b82f6",
    Challenge: "#8b5cf6",
    Funded: "#f59e0b"
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
      <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">{account ? "Edytuj konto" : "Nowe konto"}</CardTitle>
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
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
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