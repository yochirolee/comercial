"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

export interface ProductComboboxOption {
  id: string;
  nombre: string;
  abreviatura?: string;
}

interface ProductComboboxProps {
  options: ProductComboboxOption[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProductCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar producto",
  className = "",
}: ProductComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState(0);

  const selected = options.find((o) => o.id === value);

  const filtered = options.filter((o) =>
    o.nombre.toLowerCase().includes(search.toLowerCase())
  );

  function openDropdown() {
    setSearch("");
    setHighlighted(0);
    setOpen(true);
  }

  function closeDropdown() {
    setOpen(false);
    setSearch("");
  }

  function pick(id: string) {
    onValueChange(id);
    closeDropdown();
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDropdown();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlighted]) {
          pick(filtered[highlighted].id);
        }
      }
    },
    [filtered, highlighted]
  );

  // Reset highlight when filtered changes
  useEffect(() => {
    setHighlighted(0);
  }, [search]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected
            ? `${selected.nombre}${selected.abreviatura ? ` (${selected.abreviatura})` : ""}`
            : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown — always opens downward */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar producto..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* List */}
          <ul
            ref={listRef}
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-sm text-slate-400">Sin resultados</li>
            ) : (
              filtered.map((o, idx) => (
                <li
                  key={o.id}
                  onMouseDown={() => pick(o.id)}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                    idx === highlighted ? "bg-slate-100" : ""
                  }`}
                >
                  <span>
                    {o.nombre}
                    {o.abreviatura && (
                      <span className="ml-1 text-slate-400">({o.abreviatura})</span>
                    )}
                  </span>
                  {o.id === value && (
                    <Check className="h-4 w-4 text-slate-700" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
