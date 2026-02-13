import React from 'react';
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, ExternalLink, Pencil, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-red-100 text-red-800 border-red-200"
};

export default function ExpenseDetails({ expense, trips = [], onEdit }) {
  if (!expense) {
    return (
      <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5 text-slate-400" />
            Expense Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-slate-500 py-12">
            Select an expense to view details
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm sticky top-4">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Expense Details
          </span>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          </CardTitle>
          </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">Vendor</p>
          <p className="font-semibold text-slate-900 text-lg">{expense.vendor}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">Amount</p>
            <p className="font-semibold text-slate-900">
              ${expense.amount?.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Date</p>
            <p className="font-semibold text-slate-900">
              {expense.date && !isNaN(new Date(expense.date).getTime()) ? format(new Date(expense.date), "MMM d, yyyy") : "-"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-500 mb-1">Category</p>
          <p className="font-semibold text-slate-900">{expense.category}</p>
        </div>

        {expense.payment_method && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Payment Method</p>
            <p className="font-semibold text-slate-900">{expense.payment_method}</p>
          </div>
        )}

        {expense.tax > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Tax</p>
            <p className="font-semibold text-slate-900">${expense.tax?.toFixed(2)}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">Payment Source</p>
            <Badge variant="outline" className={expense.payment_source === "Personal - Reimbursable" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>
              {expense.payment_source === "Personal - Reimbursable" ? "Reimbursable" : "Company Card"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Status</p>
            <Badge variant="secondary" className={`${statusColors[expense.status]} border`}>
              {expense.status}
            </Badge>
          </div>
        </div>

        {expense.trip_id && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Trip</p>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{trips.find(t => t.id === expense.trip_id)?.name || "Unknown Trip"}</span>
            </div>
          </div>
        )}

        {expense.description && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Description</p>
            <p className="text-slate-700">{expense.description}</p>
          </div>
        )}

        {expense.items && expense.items.length > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-2">Line Items</p>
            <div className="space-y-2">
              {expense.items.map((item, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-900 text-sm">{item.description}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {item.quantity} × ${item.unit_price?.toFixed(2)} = ${item.total?.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View Receipt
          </a>
        )}
      </CardContent>
    </Card>
  );
}