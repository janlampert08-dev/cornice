"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface SettingsTab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  content: ReactNode;
}

// Einfaches Tab-Primitiv für die neue Einstellungen-Seite — es gab bisher
// keine wiederverwendbare Tab-Komponente im Projekt (nur <details>-Gruppen
// auf der Profilseite). Alle Panels bleiben im DOM (nur per `hidden`
// ausgeblendet) statt neu zu mounten, da ihr Inhalt bereits fertig vom
// Server geladen als Prop hereinkommt — kein Nachladen beim Tab-Wechsel.
export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Einstellungen" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={activeId === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActiveId(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-fast",
              activeId === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {tabs.map(({ id, content }) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={activeId !== id}>
          {content}
        </div>
      ))}
    </div>
  );
}
