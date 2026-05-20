import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PlayerCardData {
  player_id: string;
  name: string | null;
  image_url?: string | null;
  jersey_number?: string | null;
  position_name?: string | null;
  team_name?: string | null;
}

interface PlayerCardProps {
  player: PlayerCardData;
  /** "grid" = square thumbnail above name (player rosters), "row" = horizontal compact (watchlist) */
  variant?: "grid" | "row";
  /** Optional slot rendered below the metadata (e.g. wOBA stat) */
  extra?: React.ReactNode;
  className?: string;
}

export function PlayerCard({ player, variant = "grid", extra, className }: PlayerCardProps) {
  const { player_id, name, image_url, jersey_number, position_name, team_name } = player;

  if (variant === "row") {
    return (
      <Link href={`/players/${player_id}`} className={cn("block", className)}>
        <Card className="hover:shadow-md transition-shadow h-full">
          <CardContent className="p-3 flex gap-3">
            <PlayerAvatar
              src={image_url}
              alt={name ?? ""}
              fallback={jersey_number}
              size={64}
              rounded="md"
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">
                {name}
                {jersey_number && (
                  <span className="ml-1.5 text-xs text-slate-500">#{jersey_number}</span>
                )}
              </div>
              {team_name && (
                <div className="text-xs text-slate-700 truncate">{team_name}</div>
              )}
              <div className="mt-1 flex gap-1.5 items-center">
                {position_name && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{position_name}</Badge>
                )}
                {extra}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/players/${player_id}`} className={cn("block", className)}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-3">
          <PlayerAvatar
            src={image_url}
            alt={name ?? ""}
            fallback={jersey_number}
            square
            rounded="md"
            className="mb-2"
          />
          <div className="font-semibold text-sm truncate text-slate-900">{name}</div>
          {team_name && (
            <div className="text-xs text-slate-500 truncate">{team_name}</div>
          )}
          <div className="flex justify-between items-center mt-1">
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {position_name || "—"}
            </Badge>
            {jersey_number && (
              <span className="text-xs text-slate-500">#{jersey_number}</span>
            )}
          </div>
          {extra && <div className="mt-2">{extra}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string | null;
  size?: number;
  square?: boolean;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

/** Unified player photo / fallback — Savant-style ring on dark hero, plain on lists */
export function PlayerAvatar({
  src, alt = "", fallback, size = 64, square, rounded = "md", className,
}: AvatarProps) {
  const ROUND_CLS = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", full: "rounded-full" }[rounded];
  const dim = square ? undefined : size;
  return (
    <div
      className={cn(
        "bg-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0",
        ROUND_CLS,
        square && "aspect-square w-full",
        className,
      )}
      style={dim ? { width: dim, height: dim } : undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : fallback ? (
        <span className="text-slate-500 font-semibold" style={{ fontSize: Math.max(14, (dim ?? 80) * 0.32) }}>
          {fallback}
        </span>
      ) : (
        <span className="text-slate-400 text-xs">—</span>
      )}
    </div>
  );
}

// Silence unused-import lint if Next/Image is removed later.
void Image;
