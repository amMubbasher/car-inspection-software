'use client';

import { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Props {
  onSearch: (query: string) => void;
  onStatusFilter?: (status: string) => void;
}

export default function SearchBar({ onSearch, onStatusFilter }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); // default to "all"

  return (
    <div className="flex items-center gap-4 mb-4">
      <input
        type="text"
        placeholder="Search by car name or customer name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        className="border rounded px-3 py-2 w-full bg-background text-foreground"
      />

      {onStatusFilter && (
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            // interpret "all" as no filter
            onStatusFilter(value === 'all' ? '' : value);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
