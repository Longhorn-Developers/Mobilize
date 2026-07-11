import {
  ArrowUpIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowBendDoubleUpLeftIcon,
  ArrowBendDoubleUpRightIcon,
  ArrowUDownLeftIcon,
  ArrowsClockwiseIcon,
  FlagIcon,
} from "phosphor-react-native";
import React from "react";

import { ROUTING_PROFILES, type ORSRoute, type ORSStep, type RoutingProfile } from "~/utils/openRouteService";

export function getDirectionIcon(step: ORSStep, color: string, size = 28) {
  switch (step.type) {
    case 0:  return React.createElement(ArrowLeftIcon, { size, color, weight: "bold" });
    case 1:  return React.createElement(ArrowRightIcon, { size, color, weight: "bold" });
    case 2:  return React.createElement(ArrowBendDoubleUpLeftIcon, { size, color, weight: "bold" });
    case 3:  return React.createElement(ArrowBendDoubleUpRightIcon, { size, color, weight: "bold" });
    case 4:  return React.createElement(ArrowBendUpLeftIcon, { size, color, weight: "bold" });
    case 5:  return React.createElement(ArrowBendUpRightIcon, { size, color, weight: "bold" });
    case 7:
    case 8:  return React.createElement(ArrowsClockwiseIcon, { size, color, weight: "bold" });
    case 9:  return React.createElement(ArrowUDownLeftIcon, { size, color, weight: "bold" });
    case 10: return React.createElement(FlagIcon, { size, color, weight: "bold" });
    case 6:
    case 11:
    default: return React.createElement(ArrowUpIcon, { size, color, weight: "bold" });
  }
}

export function formatStepDistance(metres: number): string {
  const miles = metres * 0.000621371;
  if (miles < 0.1) return `${Math.round(metres * 3.28084)} ft`;
  return `${miles < 0.95 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

// Returns "in X feet" / "in X miles" prefix for the directions banner.
// Returns "" when the distance is too short to bother calling out (< 20 ft / ~6 m).
export function formatBannerDistance(metres: number): string {
  const feet = metres * 3.28084;
  if (feet < 20) return "";
  if (feet < 1000) return `in ${Math.round(feet)} feet`;
  const miles = metres * 0.000621371;
  if (miles < 0.95) return `in ${miles.toFixed(1)} miles`;
  return `in ${Math.round(miles)} miles`;
}

export function formatETA(durationSec: number): string {
  const arrival = new Date(Date.now() + durationSec * 1000);
  let hours = arrival.getHours();
  const minutes = arrival.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return "< 1 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles < 9.95 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function deriveRouteTags(profile: RoutingProfile, route: ORSRoute): string[] {
  const tags: string[] = [];
  const profileEntry = ROUTING_PROFILES.find((p) => p.id === profile);
  if (profileEntry) tags.push(profileEntry.label);
  if (route.totalDurationSec < 300) tags.push("Quick Route");
  return tags;
}
