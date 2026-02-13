import React from 'react';
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Image, CreditCard, Wallet, Pencil, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-red-100 text-red-800 border-red-200"
};

export default function ExpenseTable({ expenses, isLoading, onSelectExpense, onEditExpense, trips = [], selectedIds = [], onSelectionChange, onViewReceipt }) {
  const allSelected = expenses.length > 0 && selectedIds.length === expenses.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < expenses.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(expenses.map(e => e.id));
    }
  };

  const toggleOne = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter(x => x !== id));
    } else {
      onSelectionChange?.([...selectedIds, id]);
    }
  };

  const getTripName = (tripId) => {
    const trip = trips.find(t => t.id === tripId);
    return trip?.name || null;
  };

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
              <TableHead className="w-10">
                <Checkbox 
                  checked={allSelected} 
                  onCheckedChange={toggleAll}
                  className={someSelected ? "data-[state=checked]:bg-blue-600" : ""}
                />
              </TableHead>
              <TableHead className="font-semibold">Vendor</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Trip</TableHead>
              <TableHead className="font-semibold">Payment</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-500 py-12">
                  No expenses found. Upload your first receipt to get started!
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow 
                  key={expense.id}
                  className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${selectedIds.includes(expense.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => onSelectExpense(expense)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.includes(expense.id)}
                      onCheckedChange={() => toggleOne(expense.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{expense.vendor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {expense.date && !isNaN(new Date(expense.date).getTime()) ? format(new Date(expense.date), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {expense.amount?.toFixed(2)} {expense.currency || 'USD'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{expense.category || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {expense.trip_id ? (
                      <span className="flex items-center gap-1 text-sm text-blue-600">
                        <Briefcase className="w-3 h-3" />
                        {getTripName(expense.trip_id) || 'Trip'}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={expense.payment_source === "Personal - Reimbursable" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>
                      {expense.payment_source === "Personal - Reimbursable" ? (
                        <><Wallet className="w-3 h-3 mr-1" />Reimburse</>
                      ) : (
                        <><CreditCard className="w-3 h-3 mr-1" />Company</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${statusColors[expense.status]} border font-medium`}>
                      {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {expense.receipt_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReceipt?.(expense.receipt_url);
                          }}
                        >
                          <Image className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditExpense?.(expense);
                        }}
                      >
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}