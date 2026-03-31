import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine
} from "recharts";
import {
  Search, MapPin, RefreshCw, Sun, Moon, Wind, Droplets, CloudRain,
  Thermometer, ArrowUp, ArrowDown, Fish, Clock, Eye, Calendar,
  Navigation, Loader, AlertCircle, ChevronRight,
  Gauge, TrendingUp, TrendingDown, Cloud, Waves, Target, Crosshair
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
  pressure: 0.25,
  solunar: 0.20,
  wind: 0.15,
  moon: 0.10,
  timeOfDay: 0.10,
  waterTemp: 0.10,
  cloudCover: 0.05,
  pressureTrend: 0.05,
};

function getTierConfig(score) {
  if (score >= 90) return { label: "HOT", color: COLORS.hot, emoji: "🔥", desc: "Drop everything and go fish" };
  if (score >= 70) return { label: "GOOD", color: COLORS.good, emoji: "🟢", desc: "Solid conditions, should be productive" };
  if (score >= 50) return { label: "FAIR", color: COLORS.fair, emoji: "🟡", desc: "Fishable but adjust tactics" };
  return { label: "POOR", color: COLORS.poor, emoji: "🔴", desc: "Tough bite, finesse or stay home" };
}

// ─── ASTRONOMICAL UTILITIES ──────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SYNODIC_PERIOD = 29.53058867;
const REF_NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)); // Jan 6, 2000

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

  // Sunrise
  const tRise = dayOfYear + (6 - lngHour) / 24;
  const mRise = (0.9856 * tRise - 3.289);
  let lRise = mRise + (1.916 * Math.sin(mRise * DEG2RAD)) + (0.020 * Math.sin(2 * mRise * DEG2RAD)) + 282.634;
  lRise = ((lRise % 360) + 360) % 360;
  let raRise = RAD2DEG * Math.atan(0.91764 * Math.tan(lRise * DEG2RAD));
  raRise = ((raRise % 360) + 360) % 360;
  const lQuadRise = Math.floor(lRise / 90) * 90;
  const raQuadRise = Math.floor(raRise / 90) * 90;
  raRise = raRise + (lQuadRise - raQuadRise);
  raRise = raRise / 15;
  const sinDecRise = 0.39782 * Math.sin(lRise * DEG2RAD);
  const cosDecRise = Math.cos(Math.asin(sinDecRise));
  const cosHRise = (Math.cos(90.833 * DEG2RAD) - (sinDecRise * Math.sin(lat * DEG2RAD))) / (cosDecRise * Math.cos(lat * DEG2RAD));
  const hRise = 360 - RAD2DEG * Math.acos(Math.max(-1, Math.min(1, cosHRise)));
  const hRiseHours = hRise / 15;
  const tRiseLocal = hRiseHours + raRise - (0.06571 * tRise) - 6.622;
  let utRise = ((tRiseLocal - lngHour) % 24 + 24) % 24;

  // Sunset
  const tSet = dayOfYear + (18 - lngHour) / 24;
  const mSet = (0.9856 * tSet - 3.289);
  let lSet = mSet + (1.916 * Math.sin(mSet * DEG2RAD)) + (0.020 * Math.sin(2 * mSet * DEG2RAD)) + 282.634;
  lSet = ((lSet % 360) + 360) % 360;
  let raSet = RAD2DEG * Math.atan(0.91764 * Math.tan(lSet * DEG2RAD));
  raSet = ((raSet % 360) + 360) % 360;
  const lQuadSet = Math.floor(lSet / 90) * 90;
  const raQuadSet = Math.floor(raSet / 90) * 90;
  raSet = raSet + (lQuadSet - raQuadSet);
  raSet = raSet / 15;
  const sinDecSet = 0.39782 * Math.sin(lSet * DEG2RAD);
  const cosDecSet = Math.cos(Math.asin(sinDecSet));
  const cosHSet = (Math.cos(90.833 * DEG2RAD) - (sinDecSet * Math.sin(lat * DEG2RAD))) / (cosDecSet * Math.cos(lat * DEG2RAD));
  const hSet = RAD2DEG * Math.acos(Math.max(-1, Math.min(1, cosHSet)));
  const hSetHours = hSet / 15;
  const tSetLocal = hSetHours + raSet - (0.06571 * tSet) - 6.622;
  let utSet = ((tSetLocal - lngHour) % 24 + 24) % 24;

  const offset = -date.getTimezoneOffset() / 60;
  const sunriseHour = (utRise + offset) % 24;
  const sunsetHour = (utSet + offset) % 24;

  const sunrise = new Date(start.getTime() + sunriseHour * 3600000);
  const sunset = new Date(start.getTime() + sunsetHour * 3600000);
  const goldenMorning = new Date(sunrise.getTime() + 3600000);
  const goldenEvening = new Date(sunset.getTime() - 3600000);

  return { sunrise, sunset, goldenMorning, goldenEvening };
}

function calcSolunarPeriods(lat, lon, date) {
  const moon = calcMoonPhase(date);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = -date.getTimezoneOffset() / 60;

  // Approximate moon transit: moon transits ~50.47 min later each day
  // Reference: at new moon, moon transits at roughly solar noon
  const solarNoon = 12 - (lon / 15) + offset; // local solar noon in hours
  // Moon transit offset from solar noon = age * (24.84 / SYNODIC_PERIOD) hours ≈ age * 0.841 hours
  // But simplified: moon transits ~50.47 min later each day from new moon
  const transitOffset = moon.age * (50.47 / 60); // in hours
  let transit = ((solarNoon + transitOffset) % 24 + 24) % 24;

  const makePeriod = (centerHour, durationHours) => {
    const half = durationHours / 2;
    let startH = ((centerHour - half) % 24 + 24) % 24;
    let endH = ((centerHour + half) % 24 + 24) % 24;
    return {
      start: new Date(start.getTime() + startH * 3600000),
      end: new Date(start.getTime() + endH * 3600000),
      centerHour,
    };
  };

  const majors = [
    makePeriod(transit, 2),           // overhead
    makePeriod((transit + 12) % 24, 2) // underfoot
  ];

  const minors = [
    makePeriod((transit + 6) % 24, 1),  // ~moonrise
    makePeriod((transit + 18) % 24, 1)  // ~moonset
  ];

  const moonrise = new Date(start.getTime() + ((transit + 6) % 24) * 3600000);
  const moonset = new Date(start.getTime() + ((transit + 18) % 24) * 3600000);

  return { majors, minors, moonrise, moonset, transitHour: transit };
}

function estimateWaterTemp(airTemp) {
  return Math.round(airTemp * 0.85 + 5);
}

function getSpawnPhase(waterTemp) {
  if (waterTemp < 50) return {
    phase: "Winter", emoji: "❄️",
    description: "Cold water, lethargic bass holding deep on main lake structure.",
    tactics: "Slow down dramatically. Jig and blade baits on steep bluffs and main lake structure. Vertical presentations. Fish the warmest part of the day (12-3pm).",
    lures: ["Football Jig", "Blade Bait", "Jigging Spoon", "Drop Shot"]
  };
  if (waterTemp < 60) return {
    phase: "Pre-Spawn", emoji: "🌱",
    description: "Bass moving shallow and feeding aggressively. Prime time!",
    tactics: "Target transition banks, points, and secondary channels. Jerkbaits, lipless crankbaits, and Alabama rigs. Bass are moving shallow and feeding up.",
    lures: ["Jerkbait", "Lipless Crankbait", "A-Rig", "Spinnerbait"]
  };
  if (waterTemp < 70) return {
    phase: "Spawn", emoji: "🪺",
    description: "Bass on beds in shallow water. Sight fishing opportunities.",
    tactics: "Look for beds in 2-5ft on hard bottom. Sight fish with soft plastics (tube, creature bait). Don't overlook the big females cruising just off the bank.",
    lures: ["Tube", "Creature Bait", "Senko", "Small Jig"]
  };
  if (waterTemp < 75) return {
    phase: "Post-Spawn", emoji: "🔄",
    description: "Recovery period. Bass transitioning to summer patterns.",
    tactics: "Bass are recovering on the first drop-off near spawning flats. Topwater early, shaky head and drop shot mid-day. Target shade and docks.",
    lures: ["Topwater", "Shaky Head", "Drop Shot", "Fluke"]
  };
  if (waterTemp >= 75) {
    // Check if we might be in fall (cooling trend) — without trend data, use month
    const month = new Date().getMonth();
    if (month >= 8 && month <= 10) return {
      phase: "Fall", emoji: "🍂",
      description: "Bass feeding aggressively chasing shad. Cover water!",
      tactics: "Follow the shad. Fish the backs of creeks with spinnerbaits, squarebills, and jerkbaits. Bass are feeding aggressively — cover water.",
      lures: ["Squarebill Crankbait", "Spinnerbait", "Jerkbait", "Swimbait"]
    };
    return {
      phase: "Summer", emoji: "☀️",
      description: "Hot water. Focus on low-light periods and deep structure.",
      tactics: "Early morning topwater (buzzbaits, frogs, poppers). Mid-day go deep — Carolina rig, deep cranks, football jigs on main lake points and humps. Night fishing can be excellent.",
      lures: ["Buzzbait", "Frog", "Carolina Rig", "Deep Crankbait", "Football Jig"]
    };
  }
}

// ─── BITE SCORE ALGORITHM ────────────────────────────────────────────────────

function windDegToCompass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function scorePressure(pressure) {
  // pressure in hPa, convert to inHg: 1 hPa = 0.02953 inHg
  const inHg = pressure * 0.02953;
  if (inHg >= 29.90 && inHg <= 30.10) return 100;
  if (inHg > 30.10 && inHg <= 30.20) return 80;
  if (inHg >= 29.80 && inHg < 29.90) return 80;
  if (inHg > 30.20 && inHg <= 30.30) return 60;
  if (inHg >= 29.70 && inHg < 29.80) return 60;
  if (inHg > 30.30 || inHg < 29.60) return 20;
  return 40;
}

function scoreSolunar(hour, solunarPeriods) {
  const { majors, minors } = solunarPeriods;
  for (const m of majors) {
    const center = m.centerHour;
    const diff = Math.abs(((hour - center + 12) % 24) - 12);
    if (diff <= 1) return 100;
    if (diff <= 2) return 60;
  }
  for (const m of minors) {
    const center = m.centerHour;
    const diff = Math.abs(((hour - center + 12) % 24) - 12);
    if (diff <= 0.5) return 75;
    if (diff <= 1.5) return 40;
  }
  return 20;
}

function scoreWind(speed, deg) {
  let score;
  if (speed >= 5 && speed <= 15) score = 100;
  else if (speed < 5) score = 50;
  else if (speed <= 20) score = 60;
  else score = 30;

  const compass = windDegToCompass(deg);
  if (["S", "SSW", "SW"].includes(compass)) score = Math.min(100, score + 10);
  if (["N", "NNE", "NE"].includes(compass)) score = Math.max(0, score - 15);

  return score;
}

function scoreMoonPhase(moonPhase) {
  const { age } = moonPhase;
  const normalized = age / SYNODIC_PERIOD;
  // Score peaks at new (0) and full (0.5)
  const distFromPeak = Math.min(normalized, Math.abs(normalized - 0.5), 1 - normalized);
  if (distFromPeak < 0.06) return 100;  // near new or full
  if (distFromPeak < 0.12) return 70;
  if (distFromPeak < 0.19) return 50;   // quarter
  return 35;
}

function scoreTimeOfDay(hour, sunrise, sunset) {
  const sunriseH = sunrise.getHours() + sunrise.getMinutes() / 60;
  const sunsetH = sunset.getHours() + sunset.getMinutes() / 60;
  const dawnDiff = Math.abs(hour - sunriseH);
  const duskDiff = Math.abs(hour - sunsetH);

  if (dawnDiff <= 1) return 100;
  if (duskDiff <= 1) return 95;
  if (hour >= sunriseH && hour <= sunriseH + 2) return 80;
  if (hour >= sunsetH - 2 && hour <= sunsetH) return 80;
  if (hour >= sunriseH + 2 && hour <= sunsetH - 2) return 30; // midday
  return 15; // night
}

function scoreWaterTemp(waterTemp) {
  if (waterTemp >= 50 && waterTemp < 60) return 100;
  if (waterTemp >= 65 && waterTemp <= 75) return 90;
  if (waterTemp >= 60 && waterTemp < 65) return 50;
  if (waterTemp >= 75 && waterTemp <= 80) return 60;
  if (waterTemp > 80) return 40;
  return 25; // winter
}

function scoreCloudCover(clouds, windSpeed) {
  if (clouds >= 70) return 100;
  if (clouds >= 40) return 80;
  if (windSpeed >= 5) return 60;
  return 30;
}

function scorePressureTrend(currentPressure, previousPressure) {
  if (!previousPressure) return 70;
  const diff = (currentPressure - previousPressure) * 0.02953; // hPa diff to inHg
  const absDiff = Math.abs(diff);
  if (absDiff < 0.015) return 100;      // stable
  if (diff > 0 && diff < 0.06) return 90; // slowly rising
  if (diff < 0 && diff > -0.06) return 70; // slowly falling
  if (diff < -0.06) return 40;           // rapidly falling
  return 30;                             // rapidly rose (post-front)
}

function calcBiteScore({ weather, forecast3h, moonPhase, sunTimes, solunarPeriods, hour }) {
  const pressure = weather.main.pressure;
  const windSpeed = weather.wind.speed;
  const windDeg = weather.wind.deg || 0;
  const clouds = weather.clouds.all;
  const airTemp = weather.main.temp;
  const waterTemp = estimateWaterTemp(airTemp);
  const prevPressure = forecast3h ? forecast3h.main.pressure : null;
  const inHg = pressure * 0.02953;

  const factors = [
    {
      name: "Barometric Pressure",
      icon: "gauge",
      value: `${inHg.toFixed(2)} inHg`,
      score: scorePressure(pressure),
      weight: FACTOR_WEIGHTS.pressure,
    },
    {
      name: "Solunar Period",
      icon: "moon",
      value: getSolunarLabel(hour, solunarPeriods),
      score: scoreSolunar(hour, solunarPeriods),
      weight: FACTOR_WEIGHTS.solunar,
    },
    {
      name: "Wind",
      icon: "wind",
      value: `${windSpeed} mph ${windDegToCompass(windDeg)}`,
      score: scoreWind(windSpeed, windDeg),
      weight: FACTOR_WEIGHTS.wind,
    },
    {
      name: "Moon Phase",
      icon: "moonPhase",
      value: `${moonPhase.phaseName} (${Math.round(moonPhase.illumination)}%)`,
      score: scoreMoonPhase(moonPhase),
      weight: FACTOR_WEIGHTS.moon,
    },
    {
      name: "Time of Day",
      icon: "clock",
      value: formatHour(hour),
      score: scoreTimeOfDay(hour, sunTimes.sunrise, sunTimes.sunset),
      weight: FACTOR_WEIGHTS.timeOfDay,
    },
    {
      name: "Water Temp / Season",
      icon: "thermometer",
      value: `~${waterTemp}°F (${getSpawnPhase(waterTemp).phase})`,
      score: scoreWaterTemp(waterTemp),
      weight: FACTOR_WEIGHTS.waterTemp,
    },
    {
      name: "Cloud Cover",
      icon: "cloud",
      value: `${clouds}%`,
      score: scoreCloudCover(clouds, windSpeed),
      weight: FACTOR_WEIGHTS.cloudCover,
    },
    {
      name: "Pressure Trend",
      icon: "trend",
      value: getPressureTrendLabel(pressure, prevPressure),
      score: scorePressureTrend(pressure, prevPressure),
      weight: FACTOR_WEIGHTS.pressureTrend,
    },
  ];

  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  const tier = getTierConfig(totalScore);

  return { totalScore, tier, factors };
}

function getSolunarLabel(hour, solunarPeriods) {
  for (const m of solunarPeriods.majors) {
    const diff = Math.abs(((hour - m.centerHour + 12) % 24) - 12);
    if (diff <= 1) return "Major Period";
    if (diff <= 2) return "Near Major";
  }
  for (const m of solunarPeriods.minors) {
    const diff = Math.abs(((hour - m.centerHour + 12) % 24) - 12);
    if (diff <= 0.5) return "Minor Period";
    if (diff <= 1.5) return "Near Minor";
  }
  return "Between Periods";
}

function getPressureTrendLabel(current, previous) {
  if (!previous) return "Unknown";
  const diff = (current - previous) * 0.02953;
  const absDiff = Math.abs(diff);
  if (absDiff < 0.015) return "Stable";
  if (diff > 0 && diff < 0.06) return "Rising Slowly";
  if (diff > 0) return "Rising Rapidly";
  if (diff > -0.06) return "Falling Slowly";
  return "Falling Rapidly";
}

function formatHour(h) {
  const hour = Math.floor(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}${ampm}`;
}

function getConditionTactics(pressure, pressureTrend, cloudCover, windSpeed) {
  const tips = [];
  const inHg = pressure * 0.02953;
  if (pressureTrend === "Falling Slowly" || pressureTrend === "Falling Rapidly") {
    tips.push("Falling pressure — bass feed aggressively ahead of fronts. Power fish with moving baits.");
  }
  if (pressureTrend === "Rising Rapidly" || (inHg > 30.20 && cloudCover < 30)) {
    tips.push("Post-front (high pressure, bluebird) — tough bite. Downsize, slow down, target shade and cover. Drop shot and finesse.");
  }
  if (cloudCover >= 60 && windSpeed >= 5) {
    tips.push("Overcast + wind — prime conditions. Cover water with reaction baits: spinnerbaits, chatterbaits, crankbaits.");
  }
  if (cloudCover < 30 && windSpeed < 5) {
    tips.push("Calm + clear — bass are spooky. Long casts, light line, natural colors. Target deeper or shaded structure.");
  }
  if (windSpeed >= 5) {
    const dir = windDegToCompass(0); // We'd need actual wind deg here
    tips.push("Fish windblown banks and points for active bass pushed by current.");
  }
  return tips;
}

// ─── SVG SCORE GAUGE ─────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 140 }) {
  const tier = getTierConfig(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={COLORS.elevated} strokeWidth="10"
        />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={tier.color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-4xl font-bold" style={{ color: tier.color }}>{score}</span>
        <span className="text-xs font-semibold tracking-wider" style={{ color: tier.color }}>{tier.label}</span>
      </div>
    </div>
  );
}

// ─── MOON DISPLAY ────────────────────────────────────────────────────────────

function MoonDisplay({ moonPhase, solunarPeriods }) {
  const { illumination, phaseName, phaseEmoji, age } = moonPhase;
  const size = 80;
  const r = size / 2;

  // Simple moon SVG: show illuminated portion
  const phase = age / SYNODIC_PERIOD;
  let d;
  if (phase <= 0.5) {
    // Waxing: right side lit
    const sweep = Math.cos(phase * 2 * Math.PI);
    const rx = Math.abs(sweep) * r;
    d = `M ${r} 0 A ${r} ${r} 0 0 1 ${r} ${size} A ${rx} ${r} 0 0 ${sweep > 0 ? 0 : 1} ${r} 0`;
  } else {
    // Waning: left side lit
    const sweep = Math.cos(phase * 2 * Math.PI);
    const rx = Math.abs(sweep) * r;
    d = `M ${r} 0 A ${r} ${r} 0 0 0 ${r} ${size} A ${rx} ${r} 0 0 ${sweep > 0 ? 1 : 0} ${r} 0`;
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r} fill="#1a1d27" />
        <path d={d} fill="#e2e8f0" />
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
          {phaseEmoji} {phaseName}
        </span>
        <span className="text-sm" style={{ color: COLORS.textSecondary }}>
          {Math.round(illumination)}% illumination
        </span>
        {solunarPeriods && (
          <>
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>
              🌅 Rise: {formatTime(solunarPeriods.moonrise)} · Set: {formatTime(solunarPeriods.moonset)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(date) {
  if (!date) return "--";
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")}${ampm}`;
}

// ─── FACTOR CARD ─────────────────────────────────────────────────────────────

function FactorIcon({ icon }) {
  const props = { size: 16, color: COLORS.accent };
  switch (icon) {
    case "gauge": return <Gauge {...props} />;
    case "moon": return <Moon {...props} />;
    case "wind": return <Wind {...props} />;
    case "moonPhase": return <Moon {...props} />;
    case "clock": return <Clock {...props} />;
    case "thermometer": return <Thermometer {...props} />;
    case "cloud": return <Cloud {...props} />;
    case "trend": return <TrendingUp {...props} />;
    default: return <Target {...props} />;
  }
}

function FactorCard({ factor }) {
  const tier = getTierConfig(factor.score);
  const pct = factor.score;

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
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: tier.color }}
            />
          </div>
          <span className="text-xs whitespace-nowrap" style={{ color: COLORS.textSecondary }}>{factor.value}</span>
        </div>
      </div>
    </div>
  );
}

// ─── HOURLY CHART ────────────────────────────────────────────────────────────

function HourlyChart({ hourlyData, solunarPeriods }) {
  if (!hourlyData || hourlyData.length === 0) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const tier = getTierConfig(data.score);
      return (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}` }}>
          <div className="font-bold" style={{ color: tier.color }}>{data.score} — {tier.label}</div>
          <div style={{ color: COLORS.textSecondary }}>{data.label}</div>
          <div style={{ color: COLORS.textSecondary }}>{Math.round(data.temp)}°F · {data.wind} mph</div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        {solunarPeriods && solunarPeriods.majors.map((m, i) => {
          const startLabel = formatHour(m.centerHour - 1);
          const endLabel = formatHour(m.centerHour + 1);
          return (
            <ReferenceArea
              key={`major-${i}`}
              x1={startLabel}
              x2={endLabel}
              fill={COLORS.accent}
              fillOpacity={0.1}
            />
          );
        })}
        <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {hourlyData.map((entry, index) => (
            <Cell key={index} fill={getTierConfig(entry.score).color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── DAY CARD ────────────────────────────────────────────────────────────────

function getWeatherEmoji(code) {
  if (!code) return "🌤";
  if (code >= 200 && code < 300) return "⛈️";
  if (code >= 300 && code < 400) return "🌧";
  if (code >= 500 && code < 600) return "🌧";
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
    <button
      onClick={() => onSelect(day)}
      className="flex-shrink-0 rounded-xl px-3 py-3 text-center transition-all min-w-[90px]"
      style={{
        background: isSelected ? COLORS.elevated : COLORS.card,
        border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
      }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>{day.dayName}</div>
      <div className="text-2xl mb-1">{day.emoji}</div>
      <div className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>
        {Math.round(day.high)}° / {Math.round(day.low)}°
      </div>
      <div
        className="text-sm font-bold rounded-full px-2 py-0.5 mx-auto inline-block"
        style={{ background: `${tier.color}22`, color: tier.color }}
      >
        {day.peakScore}
      </div>
      <div className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{day.bestWindow}</div>
    </button>
  );
}

// ─── LOCATION SEARCH SCREEN ─────────────────────────────────────────────────

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
      // Try zip code endpoint if input looks like a zip (digits, optionally with country code)
      const isZip = /^\d{5}(-\d{4})?$/.test(q) || /^\d{4,5},\s*[A-Za-z]{2}$/.test(q);
      let data = [];
      if (isZip) {
        const zipQuery = q.includes(",") ? q : `${q},US`;
        const res = await fetch(
          `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(zipQuery)}&appid=${API_KEY}`
        );
        if (res.ok) {
          const d = await res.json();
          data = [{ name: d.name, lat: d.lat, lon: d.lon, country: d.country, state: "" }];
        }
      }
      // Always also try the direct (name) search as fallback or primary
      if (data.length === 0) {
        const res = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`
        );
        if (!res.ok) throw new Error("Search failed");
        data = await res.json();
      }
      setResults(data);
      if (data.length === 0) setError("No results found. Try a different search.");
    } catch (e) {
      setError("Search failed. Check your API key.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://api.openweathermap.org/geo/1.0/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&limit=1&appid=${API_KEY}`
          );
          const data = await res.json();
          const name = data[0] ? `${data[0].name}, ${data[0].state || data[0].country}` : "My Location";
          onSelect({ lat: pos.coords.latitude, lon: pos.coords.longitude, name });
        } catch {
          onSelect({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "My Location" });
        }
        setGeoLoading(false);
      },
      () => {
        setError("Location access denied");
        setGeoLoading(false);
      }
    );
  };

  return (
    <div className="min-h-screen p-4" style={{ background: COLORS.base }}>
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Fish size={24} color={COLORS.accent} />
          <h1 className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>BassIQ</h1>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3.5" color={COLORS.textSecondary} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchLocations()}
              placeholder="Search a lake, city, or zip..."
              className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            />
          </div>
          <button
            onClick={searchLocations}
            disabled={loading || !query.trim()}
            className="rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: COLORS.accent, color: COLORS.base }}
          >
            Search
          </button>
        </div>

        <button
          onClick={handleGeolocate}
          disabled={geoLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mb-4 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.accent }}
        >
          {geoLoading ? <Loader size={16} className="animate-spin" /> : <Navigation size={16} />}
          Use My Location
        </button>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 mb-3">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader size={24} color={COLORS.accent} className="animate-spin" />
          </div>
        )}

        <div className="space-y-2">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lon}-${i}`}
              onClick={() => onSelect({ lat: r.lat, lon: r.lon, name: `${r.name}${r.state ? `, ${r.state}` : ""}, ${r.country}` })}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-90"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <MapPin size={18} color={COLORS.accent} />
              <div>
                <div className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>{r.name}</div>
                <div className="text-xs" style={{ color: COLORS.textSecondary }}>
                  {r.state ? `${r.state}, ` : ""}{r.country} · {r.lat.toFixed(2)}°, {r.lon.toFixed(2)}°
                </div>
              </div>
              <ChevronRight size={16} color={COLORS.textSecondary} className="ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function BassIQ() {
  const [location, setLocation] = useState(null);
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
      const [weatherRes, forecastRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`),
      ]);

      if (weatherRes.status === 401 || forecastRes.status === 401) {
        setError("Invalid API key. Check your VITE_OWM_API_KEY environment variable.");
        setLoading(false);
        return;
      }

      if (!weatherRes.ok || !forecastRes.ok) {
        throw new Error("Failed to fetch weather data");
      }

      const [weather, forecastData] = await Promise.all([weatherRes.json(), forecastRes.json()]);
      setCurrentWeather(weather);
      setForecast(forecastData);
    } catch (e) {
      setError(e.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) {
      fetchWeatherData(location.lat, location.lon);
    }
  }, [location, fetchWeatherData]);

  const handleLocationSelect = (loc) => {
    setLocation(loc);
    setScreen("dashboard");
  };

  // ── Computed data ──

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const moonPhase = useMemo(() => calcMoonPhase(now), [now.toDateString()]);

  const sunTimes = useMemo(() => {
    if (!location) return null;
    return calcSunTimes(location.lat, location.lon, now);
  }, [location?.lat, location?.lon, now.toDateString()]);

  const solunarPeriods = useMemo(() => {
    if (!location) return null;
    return calcSolunarPeriods(location.lat, location.lon, now);
  }, [location?.lat, location?.lon, now.toDateString()]);

  const currentScore = useMemo(() => {
    if (!currentWeather || !sunTimes || !solunarPeriods) return null;
    const forecast3h = forecast?.list?.[0] || null;
    return calcBiteScore({
      weather: currentWeather,
      forecast3h,
      moonPhase,
      sunTimes,
      solunarPeriods,
      hour: currentHour,
    });
  }, [currentWeather, forecast, moonPhase, sunTimes, solunarPeriods, currentHour]);

  const waterTemp = useMemo(() => {
    if (!currentWeather) return null;
    return estimateWaterTemp(currentWeather.main.temp);
  }, [currentWeather?.main?.temp]);

  const spawnPhase = useMemo(() => {
    if (waterTemp === null) return null;
    return getSpawnPhase(waterTemp);
  }, [waterTemp]);

  // Build hourly data from forecast
  const hourlyData = useMemo(() => {
    if (!forecast || !sunTimes || !solunarPeriods) return [];
    const today = now.toDateString();
    const todayEntries = selectedDayIndex === 0
      ? forecast.list.filter(e => new Date(e.dt * 1000).toDateString() === today)
      : [];

    // If looking at a future day, filter by that day
    if (selectedDayIndex > 0) {
      const grouped = _.groupBy(forecast.list, e => new Date(e.dt * 1000).toDateString());
      const days = Object.keys(grouped);
      const dayKey = days[selectedDayIndex];
      if (dayKey && grouped[dayKey]) {
        return grouped[dayKey].map(entry => {
          const dt = new Date(entry.dt * 1000);
          const h = dt.getHours();
          const dayDate = new Date(dayKey);
          const daySun = calcSunTimes(location.lat, location.lon, dayDate);
          const daySolunar = calcSolunarPeriods(location.lat, location.lon, dayDate);
          const score = calcBiteScore({
            weather: { ...entry, wind: entry.wind, clouds: entry.clouds, main: entry.main },
            forecast3h: null,
            moonPhase: calcMoonPhase(dayDate),
            sunTimes: daySun,
            solunarPeriods: daySolunar,
            hour: h,
          });
          return {
            label: formatHour(h),
            score: score.totalScore,
            temp: entry.main.temp,
            wind: Math.round(entry.wind.speed),
          };
        });
      }
      return [];
    }

    return todayEntries.map(entry => {
      const dt = new Date(entry.dt * 1000);
      const h = dt.getHours();
      const score = calcBiteScore({
        weather: { ...entry, wind: entry.wind, clouds: entry.clouds, main: entry.main },
        forecast3h: null,
        moonPhase,
        sunTimes,
        solunarPeriods,
        hour: h,
      });
      return {
        label: formatHour(h),
        score: score.totalScore,
        temp: entry.main.temp,
        wind: Math.round(entry.wind.speed),
      };
    });
  }, [forecast, sunTimes, solunarPeriods, moonPhase, selectedDayIndex, location]);

  // 5-day summary
  const fiveDaySummary = useMemo(() => {
    if (!forecast || !location) return [];
    const grouped = _.groupBy(forecast.list, e => new Date(e.dt * 1000).toDateString());
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Object.entries(grouped).map(([dateStr, entries]) => {
      const date = new Date(dateStr);
      const daySun = calcSunTimes(location.lat, location.lon, date);
      const daySolunar = calcSolunarPeriods(location.lat, location.lon, date);
      const dayMoon = calcMoonPhase(date);

      const scores = entries.map(entry => {
        const h = new Date(entry.dt * 1000).getHours();
        const s = calcBiteScore({
          weather: { ...entry, wind: entry.wind, clouds: entry.clouds, main: entry.main },
          forecast3h: null,
          moonPhase: dayMoon,
          sunTimes: daySun,
          solunarPeriods: daySolunar,
          hour: h,
        });
        return { score: s.totalScore, hour: h };
      });

      const peakEntry = _.maxBy(scores, "score");
      const temps = entries.map(e => e.main.temp);
      const weatherCode = entries[Math.floor(entries.length / 2)]?.weather?.[0]?.id;

      return {
        dateStr,
        dayName: date.toDateString() === now.toDateString() ? "Today" : dayNames[date.getDay()],
        high: Math.max(...temps),
        low: Math.min(...temps),
        peakScore: peakEntry?.score || 0,
        bestWindow: peakEntry ? formatHour(peakEntry.hour) : "--",
        emoji: getWeatherEmoji(weatherCode),
      };
    }).slice(0, 5);
  }, [forecast, location]);

  const conditionTactics = useMemo(() => {
    if (!currentWeather) return [];
    const pressureTrend = getPressureTrendLabel(
      currentWeather.main.pressure,
      forecast?.list?.[0]?.main?.pressure
    );
    return getConditionTactics(
      currentWeather.main.pressure,
      pressureTrend,
      currentWeather.clouds.all,
      currentWeather.wind.speed
    );
  }, [currentWeather, forecast]);

  // ── Screens ──

  if (screen === "search") {
    return <LocationSearch onSelect={handleLocationSelect} />;
  }

  // Dashboard
  return (
    <div className="min-h-screen pb-8" style={{ background: COLORS.base }}>
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Fish size={20} color={COLORS.accent} />
            <span className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>BassIQ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScreen("search")}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}
            >
              <MapPin size={12} /> {location?.name?.split(",")[0] || "Location"}
            </button>
            <button
              onClick={() => location && fetchWeatherData(location.lat, location.lon)}
              className="rounded-lg p-1.5"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
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
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader size={32} color={COLORS.accent} className="animate-spin mb-3" />
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>Loading forecast...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ background: COLORS.card, border: "1px solid #ef4444" }}>
            <AlertCircle size={20} color="#ef4444" />
            <div>
              <div className="text-sm font-medium text-red-400">{error}</div>
              <button
                onClick={() => location && fetchWeatherData(location.lat, location.lon)}
                className="text-xs mt-1"
                style={{ color: COLORS.accent }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        {!loading && currentWeather && currentScore && (
          <>
            {/* Card 1: Hero Score */}
            <div
              className="rounded-2xl p-6 mb-4 text-center relative overflow-hidden"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <div className="relative inline-block">
                <ScoreGauge score={currentScore.totalScore} />
              </div>
              <div className="mt-2 text-sm font-medium" style={{ color: currentScore.tier.color }}>
                {currentScore.tier.emoji} {currentScore.tier.label} — {currentScore.tier.desc}
              </div>

              {/* Condition pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>
                  🌡 {Math.round(currentWeather.main.temp)}°F
                </span>
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>
                  💨 {Math.round(currentWeather.wind.speed)} mph {windDegToCompass(currentWeather.wind.deg || 0)}
                </span>
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>
                  📊 {(currentWeather.main.pressure * 0.02953).toFixed(2)} inHg
                </span>
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: COLORS.elevated, color: COLORS.textSecondary }}>
                  {moonPhase.phaseEmoji} {Math.round(moonPhase.illumination)}%
                </span>
              </div>
            </div>

            {/* Card 2: Hourly Timeline */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                <Clock size={14} className="inline mr-1" />
                {selectedDayIndex === 0 ? "Today's" : fiveDaySummary[selectedDayIndex]?.dayName + "'s"} Bite Forecast
              </h3>
              <HourlyChart hourlyData={hourlyData} solunarPeriods={solunarPeriods} />
              {hourlyData.length === 0 && (
                <div className="text-center py-4 text-xs" style={{ color: COLORS.textSecondary }}>
                  No hourly data available for this period
                </div>
              )}
            </div>

            {/* Card 3: Key Factors */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>
                <Target size={14} className="inline mr-1" />
                Key Factors
              </h3>
              <div className="divide-y" style={{ borderColor: COLORS.border }}>
                {currentScore.factors
                  .sort((a, b) => b.weight - a.weight)
                  .map((f, i) => (
                    <FactorCard key={i} factor={f} />
                  ))}
              </div>
            </div>

            {/* Card 4: 5-Day Outlook */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                <Calendar size={14} className="inline mr-1" />
                5-Day Outlook
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {fiveDaySummary.map((day, i) => (
                  <DayCard
                    key={day.dateStr}
                    day={day}
                    isSelected={selectedDayIndex === i}
                    onSelect={() => setSelectedDayIndex(i)}
                  />
                ))}
              </div>
            </div>

            {/* Card 5: Seasonal Intel */}
            {spawnPhase && (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                  <Waves size={14} className="inline mr-1" />
                  Seasonal Intel
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: `${COLORS.accent}22`, color: COLORS.accent }}
                  >
                    {spawnPhase.emoji} {spawnPhase.phase}
                  </span>
                  <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Est. water temp: ~{waterTemp}°F
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                  {spawnPhase.description}
                </p>
                <div
                  className="rounded-xl p-3 text-sm mb-3"
                  style={{ background: COLORS.elevated, color: COLORS.textPrimary }}
                >
                  🎯 <strong>Tactics:</strong> {spawnPhase.tactics}
                </div>
                <div className="flex flex-wrap gap-2">
                  {spawnPhase.lures.map(lure => (
                    <span
                      key={lure}
                      className="rounded-full px-3 py-1 text-xs"
                      style={{ background: COLORS.elevated, color: COLORS.textSecondary }}
                    >
                      🎣 {lure}
                    </span>
                  ))}
                </div>

                {/* Condition-based tips */}
                {conditionTactics.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>
                      Current Conditions Tips:
                    </div>
                    {conditionTactics.map((tip, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-2.5 text-xs"
                        style={{ background: COLORS.elevated, color: COLORS.textSecondary }}
                      >
                        💡 {tip}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card 6: Moon & Solunar Detail */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                <Moon size={14} className="inline mr-1" />
                Moon & Solunar
              </h3>
              <MoonDisplay moonPhase={moonPhase} solunarPeriods={solunarPeriods} />

              {solunarPeriods && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3" style={{ background: COLORS.elevated }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: COLORS.accent }}>
                      Major Periods (2hr)
                    </div>
                    {solunarPeriods.majors.map((m, i) => (
                      <div key={i} className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>
                        {formatTime(m.start)} – {formatTime(m.end)}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3" style={{ background: COLORS.elevated }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: COLORS.textSecondary }}>
                      Minor Periods (1hr)
                    </div>
                    {solunarPeriods.minors.map((m, i) => (
                      <div key={i} className="text-xs mb-1" style={{ color: COLORS.textPrimary }}>
                        {formatTime(m.start)} – {formatTime(m.end)}
                      </div>
                    ))}
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
          </>
        )}
      </div>
    </div>
  );
}
