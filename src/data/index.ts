import { parse } from 'smol-toml';
import raw from '../../profile.toml?raw';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Summary {
  cv: string;
  web: string;
  llm?: string;
}

export interface Project {
  id: string;
  title: string;
  tags: string[];
  featured?: boolean;
  github?: string;
  demo?: string;
  paper?: string;
  summary: Summary;
  start?: Date;
  end?: Date;
  /** Which date to mark on the parent timeline: "start" | "end" | "mid" */
  timeline_label?: string;
}

export interface Experience {
  id: string;
  role: string;
  org: string;
  location?: string;
  start: Date;
  end?: Date;
  tags: string[];
  summary: Summary;
  project?: Project[];
}

export interface Social {
  kind: string;
  href: string;
  label: string;
}

export interface Cta {
  label: string;
  href: string;
  primary: boolean;
}

export interface WhatIDo {
  icon: string;
  title: string;
  blurb: string;
}

export interface Activity {
  icon: string;
  title: string;
  blurb: string;
  note?: string;
}

export interface Site {
  name: string;
  role: string;
  greeting: string;
  tagline: string;
  bio: string;
  og_image: string;
  meta_title: string;
  meta_description: string;
  cta: Cta[];
  social: Social[];
  what_i_do: WhatIDo[];
  activity: Activity[];
}

// ─── Parse ───────────────────────────────────────────────────────────────────

interface RawProject extends Omit<Project, 'start' | 'end'> {
  start?: string;
  end?: string;
}

interface RawExperience extends Omit<Experience, 'start' | 'end' | 'tags' | 'project'> {
  start: string;
  end?: string;
  tags?: string[];
  project?: RawProject[];
}

interface RawProfile {
  site: Site;
  experience: RawExperience[];
}

const parsed = parse(raw) as unknown as RawProfile;

export const site: Site = parsed.site;

/** Parse "YYYY-MM-DD" as a local date to avoid UTC-offset month shifts. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseProject(p: RawProject): Project {
  return {
    ...p,
    start: p.start ? parseDate(p.start) : undefined,
    end: p.end ? parseDate(p.end) : undefined,
  };
}

/** Returns tags derived from project tag frequency, falling back to explicit tags. */
function tagsFromProjects(projects: Project[], fallback: string[]): string[] {
  if (projects.length === 0) return fallback;
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const tag of p.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/** Sort projects by start date descending; missing dates go last. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (!a.start && !b.start) return 0;
    if (!a.start) return 1;
    if (!b.start) return -1;
    return b.start.valueOf() - a.start.valueOf();
  });
}

/** Compute which date a project's timeline_label refers to. */
export function getTimelineDate(p: Project): Date | undefined {
  if (!p.timeline_label) return undefined;
  if (p.timeline_label === 'end') return p.end;
  if (p.timeline_label === 'mid' && p.start && p.end) {
    return new Date((p.start.valueOf() + p.end.valueOf()) / 2);
  }
  return p.start;
}

export const experience: Experience[] = parsed.experience.map((e) => {
  const projects = (e.project ?? []).map(parseProject);
  return {
    ...e,
    start: parseDate(e.start),
    end: e.end ? parseDate(e.end) : undefined,
    tags: tagsFromProjects(projects, e.tags ?? []),
    project: projects,
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type ProjectWithExperience = Project & { experience: Experience };

export function getAllProjects(): ProjectWithExperience[] {
  return experience.flatMap((e) =>
    sortProjects(e.project ?? []).map((p) => ({ ...p, experience: e }))
  );
}

export function getFeaturedProjects(): ProjectWithExperience[] {
  return getAllProjects().filter((p) => p.featured);
}
