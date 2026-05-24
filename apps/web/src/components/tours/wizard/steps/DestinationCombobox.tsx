"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@tour/ui";

export type DestinationOption = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  /** Optional micro-badges (e.g. VIP / Gold) shown beside the name in RTL pills. */
  badges?: string[];
};

function OptionBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.2rem", marginInlineStart: "0.35rem" }}>
      {badges.map((badge) => (
        <span
          key={badge}
          style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            padding: "0.05rem 0.35rem",
            borderRadius: 999,
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #e2e8f0",
          }}
        >
          {badge}
        </span>
      ))}
    </span>
  );
}

type DestinationComboboxProps = {
  label: string;
  placeholder: string;
  options: DestinationOption[];
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  excludeIds?: readonly string[];
  error?: string;
};

function includesFaInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("fa").includes(needle.toLocaleLowerCase("fa"));
}

export function DestinationCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  multiple = false,
  excludeIds = [],
  error,
}: DestinationComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selectedIds = useMemo(
    () => (Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []),
    [value],
  );
  const selected = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return options.filter((opt) => selectedSet.has(opt.id));
  }, [options, selectedIds]);

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    const base = options.filter((opt) => !excluded.has(opt.id));
    if (!trimmed) return base;
    return base.filter((opt) => includesFaInsensitive(`${opt.name} ${opt.regionName}`, trimmed));
  }, [options, excluded, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, { regionName: string; items: DestinationOption[] }>();
    for (const opt of filtered) {
      const entry = m.get(opt.regionId);
      if (entry) {
        entry.items.push(opt);
      } else {
        m.set(opt.regionId, { regionName: opt.regionName, items: [opt] });
      }
    }
    return Array.from(m.entries()).map(([regionId, v]) => ({ regionId, ...v }));
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const selectedSingle = !multiple ? selected[0] : undefined;

  const commitSingle = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };
  const commitMultiToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ordered = options.map((opt) => opt.id).filter((optId) => next.has(optId) && !excluded.has(optId));
    onChange(ordered);
    setQuery("");
    setActiveIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(flat.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Backspace" && multiple && query === "" && selectedIds.length > 0) {
      const next = selectedIds.slice(0, -1);
      onChange(next);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const current = flat[activeIndex];
      if (!current) return;
      if (multiple) commitMultiToggle(current.id);
      else commitSingle(current.id);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.4rem", position: "relative" }}>
      <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#334155" }}>{label}</label>
      {multiple && selected.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {selected.map((opt, index) => (
            <button
              key={`selected-${opt.id}-${index}`}
              type="button"
              onClick={() => commitMultiToggle(opt.id)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                padding: "0.1rem 0.5rem",
                fontSize: "0.78rem",
                background: "#f8fafc",
                cursor: "pointer",
              }}
              aria-label={`حذف ${opt.name}`}
            >
              {opt.name}
              {opt.badges?.length ? <OptionBadges badges={opt.badges} /> : null}
              <span style={{ color: "#64748b" }}> ×</span>
            </button>
          ))}
        </div>
      ) : null}
      {!multiple && selectedSingle ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            width: "fit-content",
            border: "1px solid #cbd5e1",
            borderRadius: 999,
            padding: "0.15rem 0.5rem",
            fontSize: "0.78rem",
            background: "#f8fafc",
            color: "#1e293b",
          }}
        >
          <span style={{ color: "#475569" }}>{selectedSingle.regionName}</span>
          <span>/</span>
          <span>
            {selectedSingle.name}
            {selectedSingle.badges?.length ? <OptionBadges badges={selectedSingle.badges} /> : null}
          </span>
        </div>
      ) : null}
      <Input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        error={error}
      />
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          style={{
            position: "absolute",
            top: "calc(100% + 0.2rem)",
            left: 0,
            right: 0,
            zIndex: 30,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "0.3rem",
            maxHeight: 280,
            overflow: "auto",
            background: "#fff",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
          }}
        >
          {grouped.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", padding: "0.35rem" }}>نتیجه‌ای پیدا نشد.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.regionId} style={{ marginBottom: "0.35rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#475569",
                    fontWeight: 700,
                    padding: "0.3rem 0.5rem",
                    borderBottom: "1px dashed #e2e8f0",
                    marginBottom: "0.2rem",
                  }}
                >
                  منطقه: {group.regionName}
                </div>
                {group.items.map((opt, itemIndex) => {
                  const idx = flat.findIndex((f) => f.id === opt.id);
                  const isActive = idx === activeIndex;
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <button
                      key={`${group.regionId}-${opt.id}-${itemIndex}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => (multiple ? commitMultiToggle(opt.id) : commitSingle(opt.id))}
                      style={{
                        width: "100%",
                        textAlign: "right",
                        border: "none",
                        borderRadius: 8,
                        padding: "0.4rem 0.5rem",
                        background: isActive ? "#e2e8f0" : isSelected ? "#eef2ff" : "transparent",
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.6rem",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "0.15rem" }}>
                        {opt.name}
                        {opt.badges?.length ? <OptionBadges badges={opt.badges} /> : null}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{opt.regionName}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

