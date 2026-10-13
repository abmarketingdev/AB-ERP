"use client";

import * as React from "react";
import { Infinity as InfinityIcon, Music2, Tag, Landmark, Search, Globe, Tent, UserPlus, HelpCircle } from "lucide-react";
import { CHANNEL_KIND, type LeadChannel } from "@/types/lead";

/**
 * Monochrome channel marks.
 *
 * The SRS says nothing about logos — it mentions visual treatment exactly
 * twice, both about the blue/green/red attendance colours in §3.8. But channel
 * is a first-class field (LEAD-06) that is filtered on, tracked per link
 * (ANN-04) and reported on twice (DASH-02, DASH-04), so a mark that lets the
 * eye find "Stand" in a 10 000-row table without reading earns its place.
 *
 * Three deliberate choices:
 *
 * 1. **Symbols, not logos.** These evoke the channel without reproducing
 *    anybody's trademark — Nav and Finn both have strict rules about third
 *    party use of their marks, and this is a product being sold. An infinity
 *    loop is not Meta's logo; it is a shape that brings Meta to mind.
 *
 * 2. **Monochrome, inheriting `currentColor`.** The design system reserves
 *    colour for meaning: "colour is scarce enough that any colour means
 *    something". Meta blue, TikTok cyan, Finn orange and Nav red dropped into
 *    a dense table would be the loudest thing on screen and would carry the
 *    least decision value, while competing with the status colours that
 *    actually matter.
 *
 * 3. **The mark never travels alone.** It always sits beside the channel name,
 *    because a glyph nobody has learned yet is a worse label than a word, and
 *    the design system forbids any signal that is carried by shape or colour
 *    alone.
 */

const MARKS: Record<string, { Icon: typeof Globe; title: string }> = {
  Meta: { Icon: InfinityIcon, title: "Meta — Facebook og Instagram" },
  TikTok: { Icon: Music2, title: "TikTok" },
  Finn: { Icon: Tag, title: "Finn.no" },
  Nav: { Icon: Landmark, title: "Nav — arbeidsplassen.no" },
  Indeed: { Icon: Search, title: "Indeed" },
  Nettside: { Icon: Globe, title: "Egen nettside" },
  Stand: { Icon: Tent, title: "Stand" },
  Henvisning: { Icon: UserPlus, title: "Henvist av ansatt" },
};

const FALLBACK = { Icon: HelpCircle, title: "Ukjent kanal" };

/**
 * `source` on a candidate is free-ish text — "Finn.no annonse", "Stand (Kari
 * Nordmann)", "Henvist av ansatt" — so anything rendering a candidate's origin
 * has to map it back to the channel vocabulary first.
 */
export function channelOf(raw?: string | null): string {
  if (!raw) return "Ukjent";
  const s = raw.toLowerCase();
  for (const c of ["meta", "tiktok", "finn", "nav", "indeed", "stand", "nettside"]) {
    if (s.includes(c)) return c === "tiktok" ? "TikTok" : c.charAt(0).toUpperCase() + c.slice(1);
  }
  if (s.includes("henvist")) return "Henvisning";
  return "Ukjent";
}

export function ChannelMark({
  channel,
  size = 12,
  className,
}: {
  channel: string;
  size?: number;
  className?: string;
}) {
  const { Icon, title } = MARKS[channel] ?? FALLBACK;
  return (
    <Icon
      className={className ?? "shrink-0 opacity-70"}
      style={{ width: size, height: size }}
      aria-hidden
      // The title is for the pointer; the channel name beside it is what a
      // screen reader and a colour-blind reader both get.
      role="presentation"
      data-channel={channel}
      data-title={title}
    />
  );
}

/** Mark + name, the pairing used everywhere a channel is shown. */
export function ChannelLabel({ channel, size = 12 }: { channel: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ChannelMark channel={channel} size={size} />
      {channel}
    </span>
  );
}

/** Paid / organic / stand, the type the SRS data model gives Kanal in §5. */
export function channelKind(channel: string): "betalt" | "organisk" | "stand" | null {
  return (CHANNEL_KIND as Record<string, "betalt" | "organisk" | "stand">)[channel as LeadChannel] ?? null;
}
