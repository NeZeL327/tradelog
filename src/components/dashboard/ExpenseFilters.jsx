import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

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

export default function ExpenseFilters({ filters, setFilters }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search expenses..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="pl-10 border-slate-300"
        />
      </div>
      
      <Select
        value={filters.category}
        onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
      >
        <SelectTrigger className="w-full md:w-48 border-slate-300">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CATEGORIES.map(cat => (
            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
      >
        <SelectTrigger className="w-full md:w-40 border-slate-300">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="Pending">Pending</SelectItem>
          <SelectItem value="Approved">Approved</SelectItem>
          <SelectItem value="Rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}