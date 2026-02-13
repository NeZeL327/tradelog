import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Tag, CreditCard, X } from "lucide-react";

const CATEGORIES = [
  "Meals & Entertainment", "Transportation", "Accommodation", "Office Supplies",
  "Utilities", "Software & Subscriptions", "Marketing", "Professional Services", "Equipment", "Other"
];
const PAYMENT_SOURCES = ["Company Card", "Personal - Reimbursable"];

export default function BulkActions({ selectedCount, trips, onAssignTrip, onChangeCategory, onChangePaymentSource, onClear }) {
  const [tripId, setTripId] = useState("");
  const [category, setCategory] = useState("");
  const [paymentSource, setPaymentSource] = useState("");

  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
      <span className="font-medium text-blue-900">{selectedCount} selected</span>
      
      <Select value={tripId} onValueChange={(v) => { setTripId(v); onAssignTrip(v); }}>
        <SelectTrigger className="w-40 bg-white">
          <Briefcase className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Assign Trip" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Trip</SelectItem>
          {trips.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={(v) => { setCategory(v); onChangeCategory(v); }}>
        <SelectTrigger className="w-44 bg-white">
          <Tag className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Set Category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={paymentSource} onValueChange={(v) => { setPaymentSource(v); onChangePaymentSource(v); }}>
        <SelectTrigger className="w-44 bg-white">
          <CreditCard className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Payment Source" />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="w-4 h-4 mr-1" /> Clear
      </Button>
    </div>
  );
}