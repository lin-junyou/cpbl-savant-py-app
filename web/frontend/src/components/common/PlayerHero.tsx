"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlayerHeroProps {
  name: string;
  nameEn?: string | null;
  imageUrl?: string | null;
  jerseyNumber?: string | null;
  positionName?: string | null;
  teamName?: string | null;
  /** Right-most chip — e.g. "投手 PITCHING" / "打者 BATTING" */
  roleLabel?: string;
  /** Subtitle below role pill — e.g. "Statcast 2026" */
  season?: string;
  /** Free-form bio facts row (B/T, Ht/Wt, DOB, school...) */
  facts?: Array<{ label: string; value: React.ReactNode } | null | false>;
  /** Action slot (watchlist, CSV download buttons) */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Savant-style dark navy hero with photo + name + jersey + position + facts.
 * Used on /players/[id] and reusable by /teams/[code] header and any other
 * "player-centric" view.
 */
export function PlayerHero({
  name, nameEn, imageUrl, jerseyNumber, positionName, teamName,
  roleLabel, season = "Statcast 2026", facts, actions, className,
}: PlayerHeroProps) {
  return (
    <div className={cn(
      "bg-gradient-to-b from-slate-900 to-slate-800 text-slate-50 px-6 py-6 -mx-4",
      className,
    )}>
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row gap-5 items-start">
        <div className="w-32 h-32 rounded-md overflow-hidden bg-slate-700 flex-shrink-0 ring-2 ring-slate-600">
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl font-extrabold tracking-tight">{name}</h1>
            {jerseyNumber && (
              <span className="text-2xl text-slate-400">#{jerseyNumber}</span>
            )}
            {positionName && (
              <Badge variant="secondary" className="text-sm">{positionName}</Badge>
            )}
          </div>
          {(nameEn || teamName) && (
            <div className="mt-1 text-slate-300 text-sm">
              {nameEn && <span>{nameEn}</span>}
              {nameEn && teamName && <span> · </span>}
              {teamName && <span className="font-semibold text-slate-100">{teamName}</span>}
            </div>
          )}
          {facts && facts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
              {facts.map((f, i) =>
                f ? (
                  <span key={i}>
                    <span className="opacity-70">{f.label}</span> {f.value}
                  </span>
                ) : null,
              )}
            </div>
          )}
          {(roleLabel || actions) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {roleLabel && (
                <div className="inline-flex bg-slate-800 rounded-md p-1">
                  <span className="px-3 py-1 text-xs rounded bg-red-600 text-white font-semibold">
                    {roleLabel}
                  </span>
                  {season && (
                    <span className="px-3 py-1 text-xs rounded text-slate-300">{season}</span>
                  )}
                </div>
              )}
              {/* Reset text color so outline buttons on dark hero stay readable */}
              {actions && <div className="flex items-center gap-2 flex-wrap text-slate-900">{actions}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
