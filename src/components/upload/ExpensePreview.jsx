import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

const CATEGORIES = [
  "Meals & Entertainment",
  "Transportation",
  "Accommodation",
  "Office Supplies",
  "Utilities",
  "Software & Subscriptions",
  "Marketing",
  "Professional Services",
  "Equipment",
  "Other"
];

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "Other"];
const PAYMENT_SOURCES = ["Company Card", "Personal - Reimbursable"];
const CURRENCIES = ["USD", "EUR", "GBP", "ILS", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "MXN", "BRL"];

export default function ExpensePreview({ data, onSave, onCancel, trips = [] }) {
  const [formData, setFormData] = useState({
    vendor: data.vendor || '',
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    date: data.date || new Date().toISOString().split('T')[0],
    category: data.category || 'Other',
    payment_method: data.payment_method || 'Credit Card',
    payment_source: data.payment_source || 'Company Card',
    description: data.description || '',
    receipt_url: data.receipt_url || '',
    items: data.items || [],
    tax: data.tax || 0,
    status: 'Pending',
    trip_id: data.trip_id || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="flex items-center justify-between">
          <span>Review & Edit Expense</span>
          <span className="text-sm font-normal text-slate-500">
            AI extracted data - please verify
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                placeholder="Merchant name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                  required
                  className="flex-1"
                />
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(curr => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax">Tax</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                value={formData.tax}
                onChange={(e) => setFormData(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_source">Payment Source</Label>
              <Select
                value={formData.payment_source}
                onValueChange={(value) => setFormData(prev => ({ ...prev, payment_source: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_SOURCES.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {trips.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="trip">Attach to Trip</Label>
                <Select
                  value={formData.trip_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, trip_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trip (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No trip</SelectItem>
                    {trips.map(trip => (
                      <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {formData.items && formData.items.length > 0 && (
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="text-slate-600">
                      {item.quantity} × ${item.unit_price?.toFixed(2)} = ${item.total?.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Expense
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}