// Stroke-based icon set (lucide-ish), ported from the design handoff.
// Each icon takes an optional `s` (size) prop.

export const I = {
  back: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
  ),
  chevR: (p = {}) => (
    <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
  ),
  close: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  home: (p = {}) => (
    <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></svg>
  ),
  history: (p = {}) => (
    <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
  ),
  mistakes: (p = {}) => (
    <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v9" /><circle cx="12" cy="17" r="1.2" fill="currentColor" /><path d="M5 21h14a2 2 0 0 0 1.7-3L13.7 5a2 2 0 0 0-3.4 0L3.3 18A2 2 0 0 0 5 21z" /></svg>
  ),
  settings: (p = {}) => (
    <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
  ),
  plus: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  check: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  x: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  spark: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" /></svg>
  ),
  flame: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a7 7 0 0 1-7-7c0-2 1-3.5 2-5l1 2.5C7 5 8 3 12 2c-1 2 .5 4 2 5 1.5 1 5 3 5 8a7 7 0 0 1-7 7" /></svg>
  ),
  mic: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
  ),
  speaker: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a3 3 0 0 1 0 6" /><path d="M19 6a7 7 0 0 1 0 12" /></svg>
  ),
  copy: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  download: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
  ),
  lightbulb: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12c1 .8 1.5 1.5 1.5 3v1h5v-1c0-1.5.5-2.2 1.5-3a7 7 0 0 0-4-12z" /></svg>
  ),
  upload: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
  ),
  search: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  trend: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
  ),
  turtle: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15a5 5 0 0 1 10 0" /><path d="M7 15h10" /><path d="M12 10v5M9.5 11.5 12 15M14.5 11.5 12 15" /><path d="M17 15c2 0 3-.8 3-2 0-1-.8-1.6-1.6-1.4" /><path d="M7 15c-1.4 0-2.5.4-2.5 1.4S5.6 18 7 18" /><path d="M9 15v2.5M15 15v2.5" /></svg>
  ),
  refresh: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
  ),
  user: (p = {}) => (
    <svg width={p.s || 20} height={p.s || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
  ),
}
