import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export interface TickerOption {
  symbol: string;
  name: string;
  price: number;
  type: string;
}

interface TickerComboboxProps {
  value: string;
  onChange: (symbol: string, price?: number) => void;
  options: TickerOption[];
  placeholder?: string;
  className?: string;
}

export function TickerCombobox({
  value,
  onChange,
  options,
  placeholder = "Symbol or name… (e.g. BTC, NVDA, TSLA)",
  className = "",
}: TickerComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) setQuery("");
    else setQuery(value);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toUpperCase();
  const filtered = q
    ? options.filter(
        (o) => o.symbol.includes(q) || o.name.toUpperCase().includes(q)
      )
    : options;

  const exactMatch = options.find((o) => o.symbol === q);
  const isCustom = q.length > 0 && !exactMatch;

  function select(symbol: string, price?: number) {
    setQuery(symbol);
    setOpen(false);
    onChange(symbol, price);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    onChange("", undefined);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 bg-black/30 border rounded-lg px-3 h-10 transition-colors cursor-text ${
          open
            ? "border-primary/50 shadow-[0_0_0_1px_rgba(0,212,255,0.15)]"
            : "border-white/10 hover:border-white/20"
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-sm font-mono text-white placeholder:text-muted-foreground min-w-0"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              if (filtered.length > 0) select(filtered[0].symbol, filtered[0].price);
              else if (q.length > 0) select(q);
            }
          }}
        />
        {query ? (
          <button onClick={clear} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[hsl(222,32%,8%)] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length > 0 ? (
            <>
              {filtered.map((opt) => (
                <button
                  key={opt.symbol}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                  onMouseDown={(e) => { e.preventDefault(); select(opt.symbol, opt.price); }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground bg-white/[0.03]">
                      {opt.type === "crypto" ? "CRYPTO" : "STOCK"}
                    </span>
                    <div>
                      <div className="text-sm font-mono font-600 text-white">{opt.symbol}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.name}</div>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-primary">
                    ${opt.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </button>
              ))}
              {isCustom && (
                <div className="border-t border-white/[0.06]">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
                    onMouseDown={(e) => { e.preventDefault(); select(q); }}
                  >
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">CUSTOM</span>
                    <span className="text-sm font-mono text-white">{q}</span>
                  </button>
                </div>
              )}
            </>
          ) : q.length > 0 ? (
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); select(q); }}
            >
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">CUSTOM</span>
              <span className="text-sm font-mono text-white">{q}</span>
            </button>
          ) : (
            <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">Start typing to search</div>
          )}
        </div>
      )}
    </div>
  );
}
