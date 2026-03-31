import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  Search, MapPin, RefreshCw, Moon, Wind, Fish, Clock,
  Calendar, Navigation, Loader, AlertCircle, ChevronRight,
  Gauge, TrendingUp, Cloud, Waves, Target, Thermometer,
} from "lucide-react";
import _ from "lodash";

const API_KEY = import.meta.env.VITE_OWM_API_KEY;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const COLORS = {
  base: "#0f1117",
  card: "#1a1d27",
  elevated: "#252836",
  accent: "#00d4aa",
  border: "#2a2d3a",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  hot: "#ff6b35",
  good: "#22c55e",
  fair: "#eab308",
  poor: "#6b7280",
};

const FACTOR_WEIGHTS = {
  lake:  { pressure: 0.25, solunar: 0.20, wind: 0.15, moon: 0.10, timeOfDay: 0.10, waterTemp: 0.10, cloudCover: 0.05, pressureTrend: 0.05 },
  pond:  { pressure: 0.30, solunar: 0.15, wind: 0.05, moon: 0.10, timeOfDay: 0.10, waterTemp: 0.15, cloudCover: 0.05, pressureTrend: 0.10 },
  river: { pressure: 0.10, solunar: 0.20, wind: 0.10, moon: 0.10, timeOfDay: 0.15, waterTemp: 0.15, cloudCover: 0.10, pressureTrend: 0.10 },
  canal: { pressure: 0.20, solunar: 0.15, wind: 0.15, moon: 0.10, timeOfDay: 0.15, waterTemp: 0.10, cloudCover: 0.10, pressureTrend: 0.05 },
};

const WATER_TYPES = {
  pond:  { label: "Pond",  desc: "Small water, bank cover" },
  lake:  { label: "Lake",  desc: "Open water, full structure" },
  river: { label: "River", desc: "Current & flow patterns" },
  canal: { label: "Canal", desc: "Man-made structure" },
};

const FISHING_STYLES = {
  bank:  { label: "Bank",  desc: "Shore fishing" },
  kayak: { label: "Kayak", desc: "Low profile, stealth" },
  boat:  { label: "Boat",  desc: "Full access, electronics" },
};

function getTierConfig(score) {
  if (score >= 90) return { label: "HOT", color: COLORS.hot, emoji: "🔥", desc: "Drop everything and go fish" };
  if (score >= 70) return { label: "GOOD", color: COLORS.good, emoji: "🟢", desc: "Solid conditions, should be productive" };
  if (score >= 50) return { label: "FAIR", color: COLORS.fair, emoji: "🟡", desc: "Fishable but adjust tactics" };
  return { label: "POOR", color: COLORS.poor, emoji: "🔴", desc: "Tough bite, finesse or stay home" };
}

// ─── INLINE SVG ILLUSTRATIONS ────────────────────────────────────────────────

function BassSilhouette({ width = 48, height = 28, color = COLORS.accent, opacity = 0.7, className = "" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 70" fill="none" className={className} style={{ opacity }}>
      <path d="M8 38c4-12 16-24 32-30 8-3 18-4 28-2 12 3 22 10 30 18 4 4 8 6 14 6 3 0 6 1 6 3s-3 3-6 3c-4 0-7-1-10-3-2 4-6 8-12 12-8 5-18 8-28 9-14 1-28-2-38-8C16 42 10 40 8 38z" fill={color} />
      <path d="M72 28c-2-1-3-3-2-5s3-3 5-2c1 0 2 1 2 2" fill={COLORS.base} opacity="0.6" />
      <path d="M90 30c3-2 7-5 12-5M90 32c4 0 9 2 14 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function WavePattern({ color = COLORS.accent, opacity = 0.08, className = "" }) {
  return (
    <svg width="100%" height="32" viewBox="0 0 400 32" preserveAspectRatio="none" className={className} style={{ opacity }}>
      <path d="M0 20 Q25 8 50 20 T100 20 T150 20 T200 20 T250 20 T300 20 T350 20 T400 20 V32 H0Z" fill={color} />
      <path d="M0 24 Q30 14 60 24 T120 24 T180 24 T240 24 T300 24 T360 24 T400 24 V32 H0Z" fill={color} opacity="0.6" />
    </svg>
  );
}

function WaterRipples() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="ripple1" cx="30%" cy="40%">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.06" />
          <stop offset="60%" stopColor={COLORS.accent} stopOpacity="0.02" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ripple2" cx="70%" cy="60%">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.04" />
          <stop offset="50%" stopColor={COLORS.accent} stopOpacity="0.02" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="80" r="30" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.12" />
      <circle cx="120" cy="80" r="55" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.08" />
      <circle cx="120" cy="80" r="80" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.04" />
      <circle cx="300" cy="120" r="25" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.10" />
      <circle cx="300" cy="120" r="50" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.06" />
      <circle cx="300" cy="120" r="75" fill="none" stroke={COLORS.accent} strokeWidth="0.5" opacity="0.03" />
      <rect width="100%" height="100%" fill="url(#ripple1)" />
      <rect width="100%" height="100%" fill="url(#ripple2)" />
    </svg>
  );
}

function TopographyLines() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.04 }}>
      <path d="M-20 80 Q80 40 180 80 T380 80" fill="none" stroke={COLORS.accent} strokeWidth="1" />
      <path d="M-20 120 Q100 70 200 120 T420 120" fill="none" stroke={COLORS.accent} strokeWidth="1" />
      <path d="M-20 160 Q60 120 160 160 T380 160" fill="none" stroke={COLORS.accent} strokeWidth="1" />
      <path d="M-20 200 Q120 150 220 200 T420 200" fill="none" stroke={COLORS.accent} strokeWidth="1" />
      <path d="M-20 240 Q80 200 180 240 T380 240" fill="none" stroke={COLORS.accent} strokeWidth="1" />
    </svg>
  );
}

function FishCard({ children, className = "", style = {}, showWaves = true }) {
  return (
    <div className={`rounded-2xl relative overflow-hidden mb-4 ${className}`} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, ...style }}>
      {children}
      {showWaves && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none wave-animate">
          <WavePattern />
        </div>
      )}
    </div>
  );
}

function ScreenShell({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.base }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 50% 0%, rgba(0,212,170,0.06) 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 100%, rgba(0,100,120,0.05) 0%, transparent 50%)`
        }} />
        <TopographyLines />
      </div>
      <div className="relative z-10 p-4">
        <div className="w-full max-w-md mx-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── WATER TYPE & FISHING STYLE SVG ICONS ────────────────────────────────────

function WaterTypeIcon({ type, size = 40, color = COLORS.accent }) {
  const s = size;
  if (type === "pond") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <ellipse cx="20" cy="24" rx="14" ry="8" fill={color} opacity="0.15" />
      <ellipse cx="20" cy="24" rx="14" ry="8" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M12 20c2-6 6-10 8-10s6 4 8 10" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="22" r="1" fill={color} opacity="0.5" />
      <circle cx="24" cy="26" r="0.8" fill={color} opacity="0.5" />
    </svg>
  );
  if (type === "lake") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M4 22 Q10 16 16 22 T28 22 T40 22 V34 H4Z" fill={color} opacity="0.15" />
      <path d="M4 22 Q10 16 16 22 T28 22 T40 22" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M4 26 Q12 20 20 26 T36 26" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M8 8 L10 14 M14 6 L14 12 M11 7 L14 10" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M30 10 L28 16 M32 12 L30 16" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
  if (type === "river") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M18 4 Q14 12 16 18 Q18 24 14 30 Q12 34 16 38" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" />
      <path d="M22 4 Q26 12 24 18 Q22 24 26 30 Q28 34 24 38" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5" />
      <path d="M20 10 L22 12 M20 20 L22 22 M20 30 L22 32" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
  if (type === "canal") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <rect x="10" y="6" width="20" height="28" rx="2" fill={color} opacity="0.1" />
      <line x1="10" y1="6" x2="10" y2="34" stroke={color} strokeWidth="2" />
      <line x1="30" y1="6" x2="30" y2="34" stroke={color} strokeWidth="2" />
      <path d="M10 18 L30 18" stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
      <rect x="8" y="14" width="24" height="4" rx="1" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
    </svg>
  );
  return null;
}

function FishingStyleIcon({ type, size = 40, color = COLORS.accent }) {
  const s = size;
  if (type === "bank") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M10 34 Q14 28 18 34" fill={color} opacity="0.15" />
      <path d="M6 36 Q12 30 18 36 T30 36 T40 36" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="20" y1="10" x2="20" y2="30" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 10 Q26 6 32 10" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="30" r="2" fill={color} opacity="0.4" />
    </svg>
  );
  if (type === "kayak") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M4 24 Q8 18 20 18 Q32 18 36 24" fill={color} opacity="0.12" />
      <path d="M2 24 Q8 18 20 18 Q32 18 38 24" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M0 26 Q8 22 20 22 Q32 22 40 26" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      <line x1="20" y1="8" x2="20" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="12" x2="26" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  if (type === "boat") return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M6 26 L10 20 H30 L34 26 Z" fill={color} opacity="0.15" />
      <path d="M6 26 L10 20 H30 L34 26" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M4 28 Q10 24 20 24 Q30 24 36 28" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      <line x1="20" y1="8" x2="20" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 8 L28 14" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <rect x="14" y="16" width="4" height="4" rx="0.5" fill={color} opacity="0.3" />
    </svg>
  );
  return null;
}

// ─── ASTRONOMICAL UTILITIES ──────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SYNODIC_PERIOD = 29.53058867;
const REF_NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));

function calcMoonPhase(date) {
  const diffMs = date.getTime() - REF_NEW_MOON.getTime();
  const diffDays = diffMs / 86400000;
  const age = ((diffDays % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  const illumination = (1 - Math.cos(2 * Math.PI * age / SYNODIC_PERIOD)) / 2 * 100;

  let phaseName, phaseEmoji;
  if (age < 1.85) { phaseName = "New Moon"; phaseEmoji = "🌑"; }
  else if (age < 7.38) { phaseName = "Waxing Crescent"; phaseEmoji = "🌒"; }
  else if (age < 9.23) { phaseName = "First Quarter"; phaseEmoji = "🌓"; }
  else if (age < 12.91) { phaseName = "Waxing Gibbous"; phaseEmoji = "🌔"; }
  else if (age < 16.61) { phaseName = "Full Moon"; phaseEmoji = "🌕"; }
  else if (age < 20.29) { phaseName = "Waning Gibbous"; phaseEmoji = "🌖"; }
  else if (age < 22.14) { phaseName = "Last Quarter"; phaseEmoji = "🌗"; }
  else if (age < 27.68) { phaseName = "Waning Crescent"; phaseEmoji = "🌘"; }
  else { phaseName = "New Moon"; phaseEmoji = "🌑"; }

  return { age, illumination, phaseName, phaseEmoji };
}

function calcSunTimes(lat, lon, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((start - new Date(start.getFullYear(), 0, 0)) / 86400000);
  const lngHour = lon / 15;

  const tRise = dayOfYear + (6 - lngHour) / 24;
  const mRise = 0.9856 * tRise - 3.289;
  let lRise = mRise + 1.916 * Math.sin(mRise * DEG2RAD) + 0.020 * Math.sin(2 * mRise * DEG2RAD) + 282.634;
  lRise = ((lRise % 360) + 360) % 360;
  let raRise = RAD2DEG * Math.atan(0.91764 * Math.tan(lRise * DEG2RAD));
  raRise = ((raRise % 360) + 360) % 360;
  raRise = raRise + Math.floor(lRise / 90) * 90 - Math.floor(raRise / 90) * 90;
  raRise /= 15;
  const sinDecRise = 0.39782 * Math.sin(lRise * DEG2RAD);
  const cosDecRise = Math.cos(Math.asin(sinDecRise));
  const cosHRise = (Math.cos(90.833 * DEG2RAD) - sinDecRise * Math.sin(lat * DEG2RAD)) / (cosDecRise * Math.cos(lat * DEG2RAD));
  const hRise = (360 - RAD2DEG * Math.acos(Math.max(-1, Math.min(1, cosHRise)))) / 15;
  let utRise = ((hRise + raRise - 0.06571 * tRise - 6.622 - lngHour) % 24 + 24) % 24;

  const tSet = dayOfYear + (18 - lngHour) / 24;
  const mSet = 0.9856 * tSet - 3.289;
  let lSet = mSet + 1.916 * Math.sin(mSet * DEG2RAD) + 0.020 * Math.sin(2 * mSet * DEG2RAD) + 282.634;
  lSet = ((lSet % 360) + 360) % 360;
  let raSet = RAD2DEG * Math.atan(0.91764 * Math.tan(lSet * DEG2RAD));
  raSet = ((raSet % 360) + 360) % 360;
  raSet = raSet + Math.floor(lSet / 90) * 90 - Math.floor(raSet / 90) * 90;
  raSet /= 15;
  const sinDecSet = 0.39782 * Math.sin(lSet * DEG2RAD);
  const cosDecSet = Math.cos(Math.asin(sinDecSet));
  const cosHSet = (Math.cos(90.833 * DEG2RAD) - sinDecSet * Math.sin(lat * DEG2RAD)) / (cosDecSet * Math.cos(lat * DEG2RAD));
  const hSet = RAD2DEG * Math.acos(Math.max(-1, Math.min(1, cosHSet))) / 15;
  let utSet = ((hSet + raSet - 0.06571 * tSet - 6.622 - lngHour) % 24 + 24) % 24;

  const offset = -date.getTimezoneOffset() / 60;
  const sunrise = new Date(start.getTime() + ((utRise + offset) % 24) * 3600000);
  const sunset = new Date(start.getTime() + ((utSet + offset) % 24) * 3600000);
  return { sunrise, sunset };
}

function calcSolunarPeriods(lat, lon, date) {
  const moon = calcMoonPhase(date);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = -date.getTimezoneOffset() / 60;
  const solarNoon = 12 - lon / 15 + offset;
  const transitOffset = moon.age * (50.47 / 60);
  const transit = ((solarNoon + transitOffset) % 24 + 24) % 24;

  const makePeriod = (centerHour, dur) => {
    const half = dur / 2;
    return {
      start: new Date(start.getTime() + ((centerHour - half + 24) % 24) * 3600000),
      end: new Date(start.getTime() + ((centerHour + half) % 24) * 3600000),
      centerHour,
    };
  };

  return {
    majors: [makePeriod(transit, 2), makePeriod((transit + 12) % 24, 2)],
    minors: [makePeriod((transit + 6) % 24, 1), makePeriod((transit + 18) % 24, 1)],
    moonrise: new Date(start.getTime() + ((transit + 6) % 24) * 3600000),
    moonset: new Date(start.getTime() + ((transit + 18) % 24) * 3600000),
    transitHour: transit,
  };
}

function estimateWaterTemp(airTemp) {
  return Math.round(airTemp * 0.85 + 5);
}

// ─── SPAWN PHASE + TACTICS BY WATER TYPE & FISHING STYLE ─────────────────────

const SEASON_TACTICS = {
  pond: {
    Winter:      { description: "Cold pond — bass stacked in the deepest hole.", tactics: "Fish the deepest part with small jigs, blade baits, or drop shot. Stealth is critical — light line, no splashing.", lures: ["Small Jig", "Blade Bait", "Drop Shot", "Finesse Worm"] },
    "Pre-Spawn": { description: "Pond warms fast — bass move shallow early.", tactics: "Target docks, laydowns, and overhanging trees. Downsize jerkbaits and crankbaits. Short, accurate casts.", lures: ["Small Jerkbait", "Lipless Crankbait", "Ned Rig", "Finesse Spinnerbait"] },
    Spawn:       { description: "Shallow beds easy to find. Sight fish carefully.", tactics: "Bass bed near banks in 1-4ft. Subtle soft plastics — tubes, small creatures. Stay back and pitch quietly.", lures: ["Tube", "Small Creature Bait", "Senko", "Wacky Rig"] },
    "Post-Spawn":{ description: "Bass recovering in shade near banks.", tactics: "Shaky head and Ned rig near shade and docks. Topwater first thing before sun hits. Stay stealthy.", lures: ["Shaky Head", "Ned Rig", "Pop-R", "Trick Worm"] },
    Summer:      { description: "Ponds heat fast — bass go nocturnal or hug shade.", tactics: "Fish dawn and dusk only. Topwater early, then wacky worms and Ned rigs in shade. Night buzzbaits.", lures: ["Buzzbait", "Wacky Worm", "Ned Rig", "Black Jig"] },
    Fall:        { description: "Ponds cool quickly — bass feed hard on shad.", tactics: "Small spinnerbaits and squarebills along the bank. Bass are shallow and aggressive. Cover the whole bank.", lures: ["Small Spinnerbait", "Squarebill", "Jerkbait", "Ned Rig"] },
  },
  lake: {
    Winter:      { description: "Cold water, lethargic bass on deep main lake structure.", tactics: "Slow down. Jig and blade baits on steep bluffs. Vertical presentations. Fish 12-3pm.", lures: ["Football Jig", "Blade Bait", "Jigging Spoon", "Drop Shot"] },
    "Pre-Spawn": { description: "Bass moving shallow and feeding aggressively. Prime time!", tactics: "Target transition banks, points, secondary channels. Jerkbaits, lipless cranks, A-rigs.", lures: ["Jerkbait", "Lipless Crankbait", "A-Rig", "Spinnerbait"] },
    Spawn:       { description: "Bass on beds in shallow water. Sight fishing.", tactics: "Beds in 2-5ft on hard bottom. Soft plastics (tube, creature). Big females cruising off the bank.", lures: ["Tube", "Creature Bait", "Senko", "Small Jig"] },
    "Post-Spawn":{ description: "Recovery period. Transitioning to summer patterns.", tactics: "First drop-off near spawning flats. Topwater early, shaky head and drop shot mid-day. Shade and docks.", lures: ["Topwater", "Shaky Head", "Drop Shot", "Fluke"] },
    Summer:      { description: "Hot water. Low-light periods and deep structure.", tactics: "Morning topwater (buzzbaits, frogs). Mid-day deep — C-rig, deep cranks, football jigs on humps. Night fishing.", lures: ["Buzzbait", "Frog", "Carolina Rig", "Deep Crankbait", "Football Jig"] },
    Fall:        { description: "Bass chasing shad aggressively. Cover water!", tactics: "Follow the shad. Backs of creeks with spinnerbaits, squarebills, jerkbaits. Bass are feeding — cover water.", lures: ["Squarebill", "Spinnerbait", "Jerkbait", "Swimbait"] },
  },
  river: {
    Winter:      { description: "Bass hold in deep slack water behind current breaks.", tactics: "Deep eddies, bridge pilings, slack water behind rocks. Vertical jig or heavy football jig. Put it on their nose.", lures: ["Heavy Football Jig", "Blade Bait", "Hair Jig", "Jigging Spoon"] },
    "Pre-Spawn": { description: "Bass move to backwater sloughs and feeders to stage.", tactics: "Backwater areas where current slows. Swimbaits and jerkbaits along current seams.", lures: ["Swimbait", "Jerkbait", "Ned Rig", "Lipless Crankbait"] },
    Spawn:       { description: "Bass spawn in protected backwaters off main current.", tactics: "Backwater pockets, behind islands, sloughs. Soft plastics to protected banks. Avoid main current.", lures: ["Tube", "Creature Bait", "Senko", "Small Jig"] },
    "Post-Spawn":{ description: "Bass slide back toward current edges. Ambush feeders.", tactics: "Transition from backwater to main flow. Current seams and eddies. Swimbaits and flukes.", lures: ["Fluke", "Swimbait", "Shaky Head", "Topwater"] },
    Summer:      { description: "Current brings oxygen and food. Bass stack on breaks.", tactics: "Current breaks — rocks, log jams, bridge pilings, rip rap. Heavy jigs and swimbaits. Fish the shady side.", lures: ["Heavy Jig", "Swimbait", "Deep Crankbait", "Carolina Rig"] },
    Fall:        { description: "Baitfish push into creek mouths. Bass follow hard.", tactics: "Feeder creeks and current seams. Spinnerbaits and cranks across current. Cover water fast.", lures: ["Spinnerbait", "Squarebill", "Swimbait", "Jerkbait"] },
  },
  canal: {
    Winter:      { description: "Bass stack at deeper bends and warm-water outflows.", tactics: "Deepest bends, culvert outflows, bridge pilings. Slow-rolled swimbaits and jigs. Warm discharges are gold.", lures: ["Swimbait", "Football Jig", "Blade Bait", "Ned Rig"] },
    "Pre-Spawn": { description: "Bass push toward seawalls and rip rap as canals warm.", tactics: "Pitch jigs and creatures to seawalls, rip rap, dock pilings. Canals warm faster than lakes.", lures: ["Jig & Craw", "Creature Bait", "Lipless Crankbait", "Spinnerbait"] },
    Spawn:       { description: "Bass bed against seawalls and dock pilings.", tactics: "Beds along vertical structure — seawalls, bulkheads, pilings. Soft plastics tight to the wall. Shadow lines key.", lures: ["Tube", "Senko", "Small Jig", "Creature Bait"] },
    "Post-Spawn":{ description: "Bass recover along shadow lines and under docks.", tactics: "Skip jigs and plastics under docks. Shadow lines from bridges and seawalls. Topwater at dawn.", lures: ["Skipping Jig", "Fluke", "Topwater", "Drop Shot"] },
    Summer:      { description: "Shadow lines rule. Bass under docks, bridges, overhangs.", tactics: "Pitch and flip jigs, creatures, swimbaits along structure. Shadow line bite is all day.", lures: ["Pitching Jig", "Creature Bait", "Swimbait", "Frog"] },
    Fall:        { description: "Bass stage at bends, intersections, culverts chasing bait.", tactics: "Canal intersections and bends. Spinnerbaits and squarebills along rip rap. Swimbaits past pilings.", lures: ["Spinnerbait", "Squarebill", "Swimbait", "Chatterbait"] },
  },
};

const STYLE_TIPS = {
  bank: {
    pond: "Work the entire bank systematically. Use shorter rods for accuracy around cover.",
    lake: "Focus on accessible points, docks, and riprap. Fan-cast before moving. Waders extend your range.",
    river: "Fish behind current breaks you can reach — bridge pilings, eddies near bank, rock piles. Wade carefully.",
    canal: "Walk the seawall and pitch to every piling, culvert, and shadow. Cover water on foot.",
  },
  kayak: {
    pond: "Low profile is your advantage — bass in ponds spook easy. Drift quietly, use a paddle anchor.",
    lake: "Use your stealth to get inside points and into coves. Pedal drive lets you fish hands-free on structure.",
    river: "Stay near eddies and backwaters. Anchor behind current breaks. Paddle upstream, fish back down.",
    canal: "Kayaks are perfect for canals — silent approach, skip baits under docks. Fish both walls.",
  },
  boat: {
    pond: "Use trolling motor only, stay off the bank. Electronics are overkill here — just fish cover.",
    lake: "Full advantage — use electronics to find structure, deep schools, and baitfish. Work main lake structure.",
    river: "Anchor or use spot-lock on current breaks. Drift upstream stretches. Electronics help find channel swings.",
    canal: "Trolling motor along the walls. Electronics help find bends and depth changes. Hit both sides.",
  },
};

function getSpawnPhase(waterTemp, waterType = "lake") {
  let base;
  if (waterTemp < 50) base = { phase: "Winter", emoji: "❄️" };
  else if (waterTemp < 60) base = { phase: "Pre-Spawn", emoji: "🌱" };
  else if (waterTemp < 70) base = { phase: "Spawn", emoji: "🪺" };
  else if (waterTemp < 75) base = { phase: "Post-Spawn", emoji: "🔄" };
  else {
    const month = new Date().getMonth();
    base = (month >= 8 && month <= 10) ? { phase: "Fall", emoji: "🍂" } : { phase: "Summer", emoji: "☀️" };
  }
  const typeData = SEASON_TACTICS[waterType]?.[base.phase] || SEASON_TACTICS.lake[base.phase];
  return { ...base, ...typeData };
}

// ─── BITE SCORE ALGORITHM ────────────────────────────────────────────────────

function windDegToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function scorePressure(pressure) {
  const inHg = pressure * 0.02953;
  if (inHg >= 29.90 && inHg <= 30.10) return 100;
  if ((inHg > 30.10 && inHg <= 30.20) || (inHg >= 29.80 && inHg < 29.90)) return 80;
  if ((inHg > 30.20 && inHg <= 30.30) || (inHg >= 29.70 && inHg < 29.80)) return 60;
  if (inHg > 30.30 || inHg < 29.60) return 20;
  return 40;
}

function scoreSolunar(hour, solunarPeriods) {
  for (const m of solunarPeriods.majors) {
    const diff = Math.abs(((hour - m.centerHour + 12) % 24) - 12);
    if (diff <= 1) return 100;
    if (diff <= 2) return 60;
  }
  for (const m of solunarPeriods.minors) {
    const diff = Math.abs(((hour - m.centerHour + 12) % 24) - 12);
    if (diff <= 0.5) return 75;
    if (diff <= 1.5) return 40;
  }
  return 20;
}

function scoreWind(speed, deg) {
  let score = speed >= 5 && speed <= 15 ? 100 : speed < 5 ? 50 : speed <= 20 ? 60 : 30;
  const compass = windDegToCompass(deg);
  if (["S","SSW","SW"].includes(compass)) score = Math.min(100, score + 10);
  if (["N","NNE","NE"].includes(compass)) score = Math.max(0, score - 15);
  return score;
}

function scoreMoonPhase(moonPhase) {
  const n = moonPhase.age / SYNODIC_PERIOD;
  const d = Math.min(n, Math.abs(n - 0.5), 1 - n);
  if (d < 0.06) return 100;
  if (d < 0.12) return 70;
  if (d < 0.19) return 50;
  return 35;
}

function scoreTimeOfDay(hour, sunrise, sunset) {
  const sr = sunrise.getHours() + sunrise.getMinutes() / 60;
  const ss = sunset.getHours() + sunset.getMinutes() / 60;
  if (Math.abs(hour - sr) <= 1) return 100;
  if (Math.abs(hour - ss) <= 1) return 95;
  if (hour >= sr && hour <= sr + 2) return 80;
  if (hour >= ss - 2 && hour <= ss) return 80;
  if (hour >= sr + 2 && hour <= ss - 2) return 30;
  return 15;
}

function scoreWaterTemp(wt) {
  if (wt >= 50 && wt < 60) return 100;
  if (wt >= 65 && wt <= 75) return 90;
  if (wt >= 60 && wt < 65) return 50;
  if (wt >= 75 && wt <= 80) return 60;
  if (wt > 80) return 40;
  return 25;
}

function scoreCloudCover(clouds, wind) {
  if (clouds >= 70) return 100;
  if (clouds >= 40) return 80;
  if (wind >= 5) return 60;
  return 30;
}

function scorePressureTrend(cur, prev) {
  if (!prev) return 70;
  const diff = (cur - prev) * 0.02953;
  if (Math.abs(diff) < 0.015) return 100;
  if (diff > 0 && diff < 0.06) return 90;
  if (diff < 0 && diff > -0.06) return 70;
  if (diff < -0.06) return 40;
  return 30;
}

function calcBiteScore({ weather, forecast3h, moonPhase, sunTimes, solunarPeriods, hour, waterType = "lake" }) {
  const p = weather.main.pressure;
  const ws = weather.wind.speed;
  const wd = weather.wind.deg || 0;
  const cl = weather.clouds.all;
  const wt = estimateWaterTemp(weather.main.temp);
  const pp = forecast3h?.main?.pressure || null;
  const inHg = p * 0.02953;
  const w = FACTOR_WEIGHTS[waterType] || FACTOR_WEIGHTS.lake;

  const factors = [
    { name: "Barometric Pressure", icon: "gauge", value: `${inHg.toFixed(2)} inHg`, score: scorePressure(p), weight: w.pressure },
    { name: "Solunar Period", icon: "moon", value: getSolunarLabel(hour, solunarPeriods), score: scoreSolunar(hour, solunarPeriods), weight: w.solunar },
    { name: "Wind", icon: "wind", value: `${ws} mph ${windDegToCompass(wd)}`, score: scoreWind(ws, wd), weight: w.wind },
    { name: "Moon Phase", icon: "moonPhase", value: `${moonPhase.phaseName} (${Math.round(moonPhase.illumination)}%)`, score: scoreMoonPhase(moonPhase), weight: w.moon },
    { name: "Time of Day", icon: "clock", value: formatHour(hour), score: scoreTimeOfDay(hour, sunTimes.sunrise, sunTimes.sunset), weight: w.timeOfDay },
    { name: "Water Temp / Season", icon: "thermometer", value: `~${wt}°F (${getSpawnPhase(wt, waterType).phase})`, score: scoreWaterTemp(wt), weight: w.waterTemp },
    { name: "Cloud Cover", icon: "cloud", value: `${cl}%`, score: scoreCloudCover(cl, ws), weight: w.cloudCover },
    { name: "Pressure Trend", icon: "trend", value: getPressureTrendLabel(p, pp), score: scorePressureTrend(p, pp), weight: w.pressureTrend },
  ];
  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  return { totalScore, tier: getTierConfig(totalScore), factors };
}

function getSolunarLabel(hour, sol) {
  for (const m of sol.majors) { const d = Math.abs(((hour - m.centerHour + 12) % 24) - 12); if (d <= 1) return "Major Period"; if (d <= 2) return "Near Major"; }
  for (const m of sol.minors) { const d = Math.abs(((hour - m.centerHour + 12) % 24) - 12); if (d <= 0.5) return "Minor Period"; if (d <= 1.5) return "Near Minor"; }
  return "Between Periods";
}

function getPressureTrendLabel(cur, prev) {
  if (!prev) return "Unknown";
  const d = (cur - prev) * 0.02953;
  if (Math.abs(d) < 0.015) return "Stable";
  if (d > 0 && d < 0.06) return "Rising Slowly";
  if (d > 0) return "Rising Rapidly";
  if (d > -0.06) return "Falling Slowly";
  return "Falling Rapidly";
}

function formatHour(h) {
  const hr = Math.floor(h);
  return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}${hr >= 12 ? "pm" : "am"}`;
}

function formatTime(date) {
  if (!date) return "--";
  const h = date.getHours(), m = date.getMinutes();
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

function getConditionTactics(pressure, pressureTrend, cloudCover, windSpeed, waterType = "lake") {
  const tips = [];
  const inHg = pressure * 0.02953;
  if (pressureTrend === "Falling Slowly" || pressureTrend === "Falling Rapidly") {
    if (waterType === "pond") tips.push("Falling pressure hits ponds hard — bass feed short and aggressive. Get out now with moving baits.");
    else if (waterType === "river") tips.push("Falling pressure matters less on rivers — watch water level instead. Rising water pushes bait to banks.");
    else tips.push("Falling pressure — bass feed aggressively ahead of fronts. Power fish with moving baits.");
  }
  if (pressureTrend === "Rising Rapidly" || (inHg > 30.20 && cloudCover < 30)) {
    if (waterType === "pond") tips.push("Post-front on a pond is brutal. Tiny drop shot, light line, deepest shade.");
    else if (waterType === "canal") tips.push("Post-front in canals — bass tuck tight to structure. Slow jigs against seawalls and under docks.");
    else tips.push("Post-front (high pressure, bluebird) — downsize, slow down, target shade and cover. Drop shot and finesse.");
  }
  if (cloudCover >= 60 && windSpeed >= 5) {
    if (waterType === "canal") tips.push("Overcast + wind in canals — bass roam off structure. Spinnerbaits and chatterbaits along seawalls.");
    else tips.push("Overcast + wind — prime conditions. Cover water with reaction baits: spinnerbaits, chatterbaits, crankbaits.");
  }
  if (cloudCover < 30 && windSpeed < 5) {
    if (waterType === "pond") tips.push("Calm + clear on a pond — bass see everything. Long casts, light line, natural colors. Stealth mode.");
    else if (waterType === "canal") tips.push("Calm + clear in canals — shadow lines only. Skip baits under docks, natural colors, quiet entry.");
    else tips.push("Calm + clear — bass are spooky. Long casts, light line, natural colors. Target deeper or shaded structure.");
  }
  if (windSpeed >= 5) {
    if (waterType === "pond") tips.push("Wind on a small pond — focus on the windblown bank where bait collects.");
    else if (waterType === "river") tips.push("Wind on a river — current matters more. Focus current breaks and eddies.");
    else if (waterType === "canal") tips.push("Wind in canals — cast into wind along rip rap and seawalls where bait gets pushed.");
    else tips.push("Fish windblown banks and points for active bass pushed by current.");
  }
  return tips;
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 140 }) {
  const tier = getTierConfig(score);
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={COLORS.elevated} strokeWidth="10" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={tier.color} strokeWidth="10" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-4xl font-bold" style={{ color: tier.color }}>{score}</span>
        <span className="text-xs font-semibold tracking-wider" style={{ color: tier.color }}>{tier.label}</span>
      </div>
    </div>
  );
}

function MoonDisplay({ moonPhase, solunarPeriods }) {
  const { illumination, phaseName, phaseEmoji, age } = moonPhase;
  const sz = 80, r = sz / 2;
  const phase = age / SYNODIC_PERIOD;
  const sweep = Math.cos(phase * 2 * Math.PI);
  const rx = Math.abs(sweep) * r;
  const d = phase <= 0.5
    ? `M ${r} 0 A ${r} ${r} 0 0 1 ${r} ${sz} A ${rx} ${r} 0 0 ${sweep > 0 ? 0 : 1} ${r} 0`
    : `M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${sz} A ${rx} ${r} 0 0 ${sweep > 0 ? 1 : 0} ${r} 0`;

  return (
    <div className="flex items-center gap-4">
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
        <circle cx={r} cy={r} r={r} fill="#1a1d27" />
        <path d={d} fill="#e2e8f0" />
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>{phaseEmoji} {phaseName}</span>
        <span className="text-sm" style={{ color: COLORS.textSecondary }}>{Math.round(illumination)}% illumination</span>
        {solunarPeriods && <span className="text-sm" style={{ color: COLORS.textSecondary }}>🌅 Rise: {formatTime(solunarPeriods.moonrise)} · Set: {formatTime(solunarPeriods.moonset)}</span>}
      </div>
    </div>
  );
}

function FactorIcon({ icon }) {
  const p = { size: 16, color: COLORS.accent };
  const map = { gauge: Gauge, moon: Moon, wind: Wind, moonPhase: Moon, clock: Clock, thermometer: Thermometer, cloud: Cloud, trend: TrendingUp };
  const C = map[icon] || Target;
  return <C {...p} />;
}

function FactorCard({ factor }) {
  const tier = getTierConfig(factor.score);
  return (
    <div className="flex items-center gap-3 py-2">
      <FactorIcon icon={factor.icon} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>{factor.name}</span>
          <span className="text-sm font-bold ml-2" style={{ color: tier.color }}>{factor.score}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: COLORS.elevated }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${factor.score}%`, background: tier.color }} />
          </div>
          <span className="text-xs whitespace-nowrap" style={{ color: COLORS.textSecondary }}>{factor.value}</span>
        </div>
      </div>
    </div>
  );
}

function HourlyChart({ hourlyData, solunarPeriods }) {
  if (!hourlyData?.length) return null;
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload, t = getTierConfig(d.score);
    return (
      <div className="rounded-lg px-3 py-2 text-sm" style={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}` }}>
        <div className="font-bold" style={{ color: t.color }}>{d.score} — {t.label}</div>
        <div style={{ color: COLORS.textSecondary }}>{d.label} · {Math.round(d.temp)}°F · {d.wind} mph</div>
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="label" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={false} />
        {solunarPeriods?.majors.map((m, i) => (
          <ReferenceArea key={`m${i}`} x1={formatHour(m.centerHour - 1)} x2={formatHour(m.centerHour + 1)} fill={COLORS.accent} fillOpacity={0.1} />
        ))}
        <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {hourlyData.map((e, i) => <Cell key={i} fill={getTierConfig(e.score).color} fillOpacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function getWeatherEmoji(code) {
  if (!code) return "🌤";
  if (code >= 200 && code < 300) return "⛈️";
  if (code >= 300 && code < 600) return "🌧";
  if (code >= 600 && code < 700) return "❄️";
  if (code >= 700 && code < 800) return "🌫";
  if (code === 800) return "☀️";
  if (code === 801) return "🌤";
  if (code <= 803) return "⛅";
  return "☁️";
}

function DayCard({ day, isSelected, onSelect }) {
  const tier = getTierConfig(day.peakScore);
  return (
    <button onClick={() => onSelect(day)} className="flex-shrink-0 rounded-xl px-3 py-3 text-center transition-all min-w-[90px]" style={{ background: isSelected ? COLORS.elevated : COLORS.card, border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}` }}>
      <div className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>{day.dayName}</div>
      <div className="text-2xl mb-1">{day.emoji}</div>
      <div className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>{Math.round(day.high)}° / {Math.round(day.low)}°</div>
      <div className="text-sm font-bold rounded-full px-2 py-0.5 mx-auto inline-block" style={{ background: `${tier.color}22`, color: tier.color }}>{day.peakScore}</div>
      <div className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{day.bestWindow}</div>
    </button>
  );
}

// ─── LOCATION SEARCH ─────────────────────────────────────────────────────────

function LocationSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  const searchLocations = useCallback(async () => {
    const q = query.trim();
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    setError("");
    try {
      const isZip = /^\d{5}(-\d{4})?$/.test(q) || /^\d{4,5},\s*[A-Za-z]{2}$/.test(q);
      let data = [];
      if (isZip) {
        const zipQuery = q.includes(",") ? q : `${q},US`;
        const res = await fetch(`https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(zipQuery)}&appid=${API_KEY}`);
        if (res.ok) { const d = await res.json(); data = [{ name: d.name, lat: d.lat, lon: d.lon, country: d.country, state: "" }]; }
      }
      if (data.length === 0) {
        const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
        if (!res.ok) throw new Error("Search failed");
        data = await res.json();
      }
      setResults(data);
      if (data.length === 0) setError("No results found. Try a different search.");
    } catch { setError("Search failed. Check your API key."); }
    finally { setLoading(false); }
  }, [query]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&limit=1&appid=${API_KEY}`);
          const data = await res.json();
          onSelect({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: data[0] ? `${data[0].name}, ${data[0].state || data[0].country}` : "My Location" });
        } catch { onSelect({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "My Location" }); }
        setGeoLoading(false);
      },
      () => { setError("Location access denied"); setGeoLoading(false); }
    );
  };

  return (
    <ScreenShell>
      <div className="flex items-center gap-3 mb-2 pt-6">
        <BassSilhouette width={56} height={32} opacity={0.9} />
        <h1 className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>BassIQ</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: COLORS.textSecondary }}>Know when the bass are biting</p>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3.5" color={COLORS.textSecondary} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchLocations()} placeholder="Search a lake, city, or zip..." className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }} />
        </div>
        <button onClick={searchLocations} disabled={loading || !query.trim()} className="rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40" style={{ background: COLORS.accent, color: COLORS.base }}>Search</button>
      </div>

      <button onClick={handleGeolocate} disabled={geoLoading} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mb-4 text-sm font-medium transition-opacity hover:opacity-90" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.accent }}>
        {geoLoading ? <Loader size={16} className="animate-spin" /> : <Navigation size={16} />} Use My Location
      </button>

      {error && <div className="flex items-center gap-2 text-xs text-red-400 mb-3"><AlertCircle size={14} /> {error}</div>}
      {loading && <div className="flex justify-center py-8"><Loader size={24} color={COLORS.accent} className="animate-spin" /></div>}

      <div className="space-y-2">
        {results.map((r, i) => (
          <button key={`${r.lat}-${r.lon}-${i}`} onClick={() => onSelect({ lat: r.lat, lon: r.lon, name: `${r.name}${r.state ? `, ${r.state}` : ""}, ${r.country}` })} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-90" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <MapPin size={18} color={COLORS.accent} />
            <div>
              <div className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>{r.name}</div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>{r.state ? `${r.state}, ` : ""}{r.country} · {r.lat.toFixed(2)}°, {r.lon.toFixed(2)}°</div>
            </div>
            <ChevronRight size={16} color={COLORS.textSecondary} className="ml-auto" />
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

// ─── SETUP SCREEN (Water Type + Fishing Style) ──────────────────────────────

function SetupScreen({ locationName, onComplete }) {
  const [step, setStep] = useState("watertype"); // "watertype" | "fishingstyle"
  const [waterType, setWaterType] = useState(null);

  const handleWaterType = (wt) => {
    setWaterType(wt);
    setStep("fishingstyle");
  };

  const handleFishingStyle = (fs) => {
    onComplete(waterType, fs);
  };

  const items = step === "watertype"
    ? Object.entries(WATER_TYPES).map(([k, v]) => ({ key: k, ...v, IconComponent: WaterTypeIcon }))
    : Object.entries(FISHING_STYLES).map(([k, v]) => ({ key: k, ...v, IconComponent: FishingStyleIcon }));

  return (
    <ScreenShell>
      <div className="flex items-center gap-3 mb-2 pt-6">
        <BassSilhouette width={56} height={32} opacity={0.9} />
        <h1 className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>BassIQ</h1>
      </div>
      <p className="text-sm mb-1" style={{ color: COLORS.textSecondary }}>
        <MapPin size={12} className="inline mr-1" />{locationName}
        {waterType && <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ background: `${COLORS.accent}22`, color: COLORS.accent }}>{WATER_TYPES[waterType].label}</span>}
      </p>
      <p className="text-base font-medium mb-6" style={{ color: COLORS.textPrimary }}>
        {step === "watertype" ? "What type of water are you fishing?" : "How are you fishing?"}
      </p>

      <div className={step === "watertype" ? "grid grid-cols-2 gap-3" : "grid grid-cols-3 gap-3"}>
        {items.map(({ key, label, desc, IconComponent }) => (
          <button
            key={key}
            onClick={() => step === "watertype" ? handleWaterType(key) : handleFishingStyle(key)}
            className="rounded-2xl p-5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${COLORS.accent}11, transparent 70%)` }} />
            <div className="relative z-10">
              <div className="flex justify-center mb-3">
                <IconComponent type={key} size={48} />
              </div>
              <div className="text-sm font-semibold mb-1" style={{ color: COLORS.textPrimary }}>{label}</div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>{desc}</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none wave-animate-slow">
              <WavePattern opacity={0.06} />
            </div>
          </button>
        ))}
      </div>

      {step === "fishingstyle" && (
        <button onClick={() => setStep("watertype")} className="mt-4 text-xs" style={{ color: COLORS.textSecondary }}>
          ← Back to water type
        </button>
      )}
    </ScreenShell>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function BassIQ() {
  const [location, setLocation] = useState(null);
  const [waterType, setWaterType] = useState("lake");
  const [fishingStyle, setFishingStyle] = useState("bank");
  const [screen, setScreen] = useState("search");
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const fetchWeatherData = useCallback(async (lat, lon) => {
    setLoading(true);
    setError("");
    try {
      const [wr, fr] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`),
      ]);
      if (wr.status === 401 || fr.status === 401) { setError("Invalid API key. Check VITE_OWM_API_KEY."); setLoading(false); return; }
      if (!wr.ok || !fr.ok) throw new Error("Failed to fetch weather data");
      const [weather, forecastData] = await Promise.all([wr.json(), fr.json()]);
      setCurrentWeather(weather);
      setForecast(forecastData);
    } catch (e) { setError(e.message || "Failed to fetch weather data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (location) fetchWeatherData(location.lat, location.lon); }, [location, fetchWeatherData]);

  const handleLocationSelect = (loc) => { setLocation(loc); setScreen("setup"); };
  const handleSetupComplete = (wt, fs) => { setWaterType(wt); setFishingStyle(fs); setScreen("dashboard"); };

  // ── Computed data ──
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const moonPhase = useMemo(() => calcMoonPhase(now), [now.toDateString()]);
  const sunTimes = useMemo(() => location ? calcSunTimes(location.lat, location.lon, now) : null, [location?.lat, location?.lon, now.toDateString()]);
  const solunarPeriods = useMemo(() => location ? calcSolunarPeriods(location.lat, location.lon, now) : null, [location?.lat, location?.lon, now.toDateString()]);

  const currentScore = useMemo(() => {
    if (!currentWeather || !sunTimes || !solunarPeriods) return null;
    return calcBiteScore({ weather: currentWeather, forecast3h: forecast?.list?.[0] || null, moonPhase, sunTimes, solunarPeriods, hour: currentHour, waterType });
  }, [currentWeather, forecast, moonPhase, sunTimes, solunarPeriods, currentHour, waterType]);

  const waterTemp = useMemo(() => currentWeather ? estimateWaterTemp(currentWeather.main.temp) : null, [currentWeather?.main?.temp]);
  const spawnPhase = useMemo(() => waterTemp !== null ? getSpawnPhase(waterTemp, waterType) : null, [waterTemp, waterType]);

  const hourlyData = useMemo(() => {
    if (!forecast || !sunTimes || !solunarPeriods) return [];
    const makeEntry = (entry, sun, sol, mp) => {
      const h = new Date(entry.dt * 1000).getHours();
      const s = calcBiteScore({ weather: { ...entry, wind: entry.wind, clouds: entry.clouds, main: entry.main }, forecast3h: null, moonPhase: mp, sunTimes: sun, solunarPeriods: sol, hour: h, waterType });
      return { label: formatHour(h), score: s.totalScore, temp: entry.main.temp, wind: Math.round(entry.wind.speed) };
    };
    if (selectedDayIndex > 0) {
      const grouped = _.groupBy(forecast.list, e => new Date(e.dt * 1000).toDateString());
      const dayKey = Object.keys(grouped)[selectedDayIndex];
      if (!dayKey) return [];
      const dayDate = new Date(dayKey);
      const ds = calcSunTimes(location.lat, location.lon, dayDate);
      const dsl = calcSolunarPeriods(location.lat, location.lon, dayDate);
      const dm = calcMoonPhase(dayDate);
      return grouped[dayKey].map(e => makeEntry(e, ds, dsl, dm));
    }
    return forecast.list.filter(e => new Date(e.dt * 1000).toDateString() === now.toDateString()).map(e => makeEntry(e, sunTimes, solunarPeriods, moonPhase));
  }, [forecast, sunTimes, solunarPeriods, moonPhase, selectedDayIndex, location, waterType]);

  const fiveDaySummary = useMemo(() => {
    if (!forecast || !location) return [];
    const grouped = _.groupBy(forecast.list, e => new Date(e.dt * 1000).toDateString());
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return Object.entries(grouped).map(([dateStr, entries]) => {
      const date = new Date(dateStr);
      const ds = calcSunTimes(location.lat, location.lon, date);
      const dsl = calcSolunarPeriods(location.lat, location.lon, date);
      const dm = calcMoonPhase(date);
      const scores = entries.map(e => {
        const h = new Date(e.dt * 1000).getHours();
        return { score: calcBiteScore({ weather: { ...e, wind: e.wind, clouds: e.clouds, main: e.main }, forecast3h: null, moonPhase: dm, sunTimes: ds, solunarPeriods: dsl, hour: h, waterType }).totalScore, hour: h };
      });
      const peak = _.maxBy(scores, "score");
      const temps = entries.map(e => e.main.temp);
      return { dateStr, dayName: date.toDateString() === now.toDateString() ? "Today" : dayNames[date.getDay()], high: Math.max(...temps), low: Math.min(...temps), peakScore: peak?.score || 0, bestWindow: peak ? formatHour(peak.hour) : "--", emoji: getWeatherEmoji(entries[Math.floor(entries.length / 2)]?.weather?.[0]?.id) };
    }).slice(0, 5);
  }, [forecast, location, waterType]);

  const conditionTactics = useMemo(() => {
    if (!currentWeather) return [];
    const pt = getPressureTrendLabel(currentWeather.main.pressure, forecast?.list?.[0]?.main?.pressure);
    return getConditionTactics(currentWeather.main.pressure, pt, currentWeather.clouds.all, currentWeather.wind.speed, waterType);
  }, [currentWeather, forecast, waterType]);

  const styleTip = STYLE_TIPS[fishingStyle]?.[waterType] || "";

  // ── Screens ──

  if (screen === "search") return <LocationSearch onSelect={handleLocationSelect} />;
  if (screen === "setup") return <SetupScreen locationName={location?.name || ""} onComplete={handleSetupComplete} />;

  // ── Dashboard ──
  return (
    <div className="min-h-screen pb-8 relative overflow-hidden" style={{ background: COLORS.base }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 10%, rgba(0,212,170,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 30%, rgba(0,80,120,0.06) 0%, transparent 40%), radial-gradient(ellipse at 50% 90%, rgba(0,150,130,0.04) 0%, transparent 50%)` }} />
      <div className="fixed inset-0 pointer-events-none"><TopographyLines /></div>

      <div className="relative z-10 max-w-md mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <BassSilhouette width={40} height={24} opacity={0.85} />
            <span className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>BassIQ</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScreen("setup")} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: `${COLORS.accent}18`, border: `1px solid ${COLORS.accent}33`, color: COLORS.accent }}>
              <WaterTypeIcon type={waterType} size={14} /> {WATER_TYPES[waterType].label}
            </button>
            <button onClick={() => setScreen("setup")} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: `${COLORS.accent}18`, border: `1px solid ${COLORS.accent}33`, color: COLORS.accent }}>
              <FishingStyleIcon type={fishingStyle} size={14} /> {FISHING_STYLES[fishingStyle].label}
            </button>
            <button onClick={() => setScreen("search")} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}>
              <MapPin size={12} /> {location?.name?.split(",")[0] || "Location"}
            </button>
            <button onClick={() => location && fetchWeatherData(location.lat, location.lon)} className="rounded-lg p-1.5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <RefreshCw size={14} color={COLORS.textSecondary} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="text-xs mb-4" style={{ color: COLORS.textSecondary }}>
          <Calendar size={12} className="inline mr-1" />
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>

        {/* Loading */}
        {loading && <div className="flex flex-col items-center justify-center py-20"><Loader size={32} color={COLORS.accent} className="animate-spin mb-3" /><span className="text-sm" style={{ color: COLORS.textSecondary }}>Loading forecast...</span></div>}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ background: COLORS.card, border: "1px solid #ef4444" }}>
            <AlertCircle size={20} color="#ef4444" />
            <div>
              <div className="text-sm font-medium text-red-400">{error}</div>
              <button onClick={() => location && fetchWeatherData(location.lat, location.lon)} className="text-xs mt-1" style={{ color: COLORS.accent }}>Try again</button>
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        {!loading && currentWeather && currentScore && (
          <>
            {/* Card 1: Hero Score */}
            <div className="rounded-2xl p-6 mb-4 text-center relative overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="absolute inset-0 pointer-events-none"><WaterRipples /></div>
              <div className="absolute inset-0 pointer-events-none water-shimmer" />
              <div className="absolute top-3 right-3 pointer-events-none"><BassSilhouette width={72} height={42} opacity={0.06} color={COLORS.textPrimary} /></div>
              <div className="relative z-10">
                <div className="relative inline-block"><ScoreGauge score={currentScore.totalScore} /></div>
                <div className="mt-2 text-sm font-medium" style={{ color: currentScore.tier.color }}>{currentScore.tier.emoji} {currentScore.tier.label} — {currentScore.tier.desc}</div>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {[
                    `🌡 ${Math.round(currentWeather.main.temp)}°F`,
                    `💨 ${Math.round(currentWeather.wind.speed)} mph ${windDegToCompass(currentWeather.wind.deg || 0)}`,
                    `📊 ${(currentWeather.main.pressure * 0.02953).toFixed(2)} inHg`,
                    `${moonPhase.phaseEmoji} ${Math.round(moonPhase.illumination)}%`,
                  ].map((pill, i) => (
                    <span key={i} className="rounded-full px-3 py-1 text-xs" style={{ background: `${COLORS.elevated}cc`, color: COLORS.textSecondary }}>{pill}</span>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none wave-animate"><WavePattern opacity={0.12} /></div>
            </div>

            {/* Card 2: Hourly Timeline */}
            <FishCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                  <Clock size={14} className="inline mr-1" />
                  {selectedDayIndex === 0 ? "Today's" : fiveDaySummary[selectedDayIndex]?.dayName + "'s"} Bite Forecast
                </h3>
                <HourlyChart hourlyData={hourlyData} solunarPeriods={solunarPeriods} />
                {hourlyData.length === 0 && <div className="text-center py-4 text-xs" style={{ color: COLORS.textSecondary }}>No hourly data available for this period</div>}
              </div>
            </FishCard>

            {/* Card 3: Key Factors */}
            <FishCard showWaves={false}>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}><Target size={14} className="inline mr-1" /> Key Factors</h3>
                <div className="divide-y" style={{ borderColor: COLORS.border }}>
                  {currentScore.factors.sort((a, b) => b.weight - a.weight).map((f, i) => <FactorCard key={i} factor={f} />)}
                </div>
              </div>
            </FishCard>

            {/* Card 4: 5-Day Outlook */}
            <FishCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}><Calendar size={14} className="inline mr-1" /> 5-Day Outlook</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {fiveDaySummary.map((day, i) => <DayCard key={day.dateStr} day={day} isSelected={selectedDayIndex === i} onSelect={() => setSelectedDayIndex(i)} />)}
                </div>
              </div>
            </FishCard>

            {/* Card 5: Seasonal Intel + Style Tip */}
            {spawnPhase && (
              <FishCard>
                <div className="p-4 relative">
                  <div className="absolute bottom-8 right-4 pointer-events-none"><BassSilhouette width={80} height={48} opacity={0.04} color={COLORS.textPrimary} /></div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}><Waves size={14} className="inline mr-1" /> Seasonal Intel</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${COLORS.accent}22`, color: COLORS.accent }}>{spawnPhase.emoji} {spawnPhase.phase}</span>
                    <span className="text-xs" style={{ color: COLORS.textSecondary }}>Est. water temp: ~{waterTemp}°F</span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>{spawnPhase.description}</p>
                  <div className="rounded-xl p-3 text-sm mb-3" style={{ background: COLORS.elevated, color: COLORS.textPrimary }}>
                    🎯 <strong>Tactics:</strong> {spawnPhase.tactics}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {spawnPhase.lures.map(lure => <span key={lure} className="rounded-full px-3 py-1 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>🎣 {lure}</span>)}
                  </div>

                  {/* Fishing style tip */}
                  {styleTip && (
                    <div className="rounded-xl p-3 text-sm mb-3" style={{ background: `${COLORS.accent}0d`, border: `1px solid ${COLORS.accent}22`, color: COLORS.textPrimary }}>
                      <FishingStyleIcon type={fishingStyle} size={14} color={COLORS.accent} /> <strong className="text-xs" style={{ color: COLORS.accent }}>{FISHING_STYLES[fishingStyle].label} Tip:</strong> <span className="text-xs" style={{ color: COLORS.textSecondary }}>{styleTip}</span>
                    </div>
                  )}

                  {/* Condition-based tips */}
                  {conditionTactics.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>Current Conditions Tips:</div>
                      {conditionTactics.map((tip, i) => <div key={i} className="rounded-lg p-2.5 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>💡 {tip}</div>)}
                    </div>
                  )}
                </div>
              </FishCard>
            )}

            {/* Card 6: Moon & Solunar Detail */}
            <FishCard>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}><Moon size={14} className="inline mr-1" /> Moon & Solunar</h3>
                <MoonDisplay moonPhase={moonPhase} solunarPeriods={solunarPeriods} />
                {solunarPeriods && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: COLORS.elevated }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: COLORS.accent }}>Major Periods (2hr)</div>
                      {solunarPeriods.majors.map((m, i) => <div key={i} className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>{formatTime(m.start)} – {formatTime(m.end)}</div>)}
                    </div>
                    <div className="rounded-xl p-3" style={{ background: COLORS.elevated }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: COLORS.textSecondary }}>Minor Periods (1hr)</div>
                      {solunarPeriods.minors.map((m, i) => <div key={i} className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>{formatTime(m.start)} – {formatTime(m.end)}</div>)}
                    </div>
                  </div>
                )}
                {sunTimes && (
                  <div className="mt-3 flex gap-4 text-xs" style={{ color: COLORS.textSecondary }}>
                    <span>🌅 Sunrise: {formatTime(sunTimes.sunrise)}</span>
                    <span>🌇 Sunset: {formatTime(sunTimes.sunset)}</span>
                  </div>
                )}
              </div>
            </FishCard>
          </>
        )}
      </div>
    </div>
  );
}
