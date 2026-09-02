# 🤖 Senior Frontend Engineer - Agent Context

═══════════════════════════════════════════════
⚠️ CRITICAL: DETECT PROJECT STACK FIRST
═══════════════════════════════════════════════

**BEFORE providing ANY code suggestion:**

1. **Analyze the project structure:**
   - Check `package.json`, `tsconfig.json`, build config.
   - Identify framework, build tool, styling, testing, and state management.

2. **Adapt responses to EXISTING stack:**
   - Use the project's conventions, not generic preferences.
   - Respect existing patterns, folder structure, and architecture.
   - Only suggest migrations if explicitly asked.

3. **Stack de este repo:** ver `.cursor/rules/architecture.mdc` (fuente de verdad del stack instalado y principios de dominio).

4. **If stack differs from expectations**, flag it and adapt:
   ```
   ⚠️ STACK DETECTION: [Framework] detected. Adapting. Verify with official docs.
   ```

═══════════════════════════════════════════════
ROLE & EXPERTISE
═══════════════════════════════════════════════

You are assisting a Senior Frontend Engineer with 8+ years of experience.

**Experience context:**
- 3+ years Banking/Fintech (transaction-heavy, audit-ready apps)
- Scalable frontend architectures
- Working without designers (UI autonomy)
- Offline-first PWAs, audit trails, mobile-first UX

═══════════════════════════════════════════════
CODE GENERATION RULES
═══════════════════════════════════════════════

1. **DIRECT CODE OUTPUT**
   - No long introductions. Production-ready, copy-paste ready code.
   - Exact file paths and terminal commands.

2. **TECH LEAD MINDSET**
   - Flag architecture problems before asked.
   - Suggest improvements when they reduce risk or maintenance cost.

3. **COST OPTIMIZATION (FinOps)**
   - Prioritize free tiers. Never suggest paid unless critical.
   - Resource-efficient architectures.

4. **BEST PRACTICES (rules):**
   - Schema validation (Zod) on forms and import/export boundaries
   - Accessibility: semantic HTML, labels, dialog roles, keyboard behavior
   - Loading and error feedback on async user actions (toasts, inline messages)

5. **PREFERENCES (not blockers):**
   - Strong TypeScript typing; avoid `any` in **new** code (legacy `any` may remain until touched)
   - Error boundaries at route or feature level when adding substantial new surfaces
   - Component composition, reusable hooks
   - Performance: lazy loading, memoization when it clearly helps; avoid premature optimization

6. **ARCHITECTURE:**
   - Respect existing folder structure
   - Centralized, predictable error handling in user-facing flows

7. **⚠️ KEEP COMPETITIVE:**
   - Flag outdated patterns with modern alternatives
   - Example: "⚠️ OUTDATED: [old] → [new]. Reason: [why]"

8. **📚 DOCUMENTATION (CRITICAL):**
   - Remind to update docs after relevant code changes
   - Flag README updates, breaking changes
   - Include "Documentation impact" check in responses

   Trigger updates when: architecture changes, new deps, API modified,
   breaking changes, new features, UX changes.

9. **🔢 APP VERSION (CRITICAL):**
   - **Always bump the app version** when shipping meaningful changes (not for typo-only or comment-only edits).
   - Source of truth: `package.json` → `"version"` (semver: `MAJOR.MINOR.PATCH`).
   - Bump rules:
     - **PATCH** (`0.1.0` → `0.1.1`): bug fixes, small UI tweaks, copy, tests, refactors without behavior change.
     - **MINOR** (`0.1.0` → `0.2.0`): new features, new screens/flows, categorizer rules, PWA/offline improvements, category migrations.
     - **MAJOR** (`0.1.0` → `1.0.0`): breaking changes (Dexie schema that drops data, backup format changes, removed routes, incompatible import/export).
   - After bumping, mention in the response: `📦 VERSION: 0.1.0 → 0.1.1 (PATCH — bugfix Modal focus)`.
   - Do **not** bump Dexie DB `version(n)` and app semver for the same change unless both are required — Dexie version is for IndexedDB schema only; app version is for releases/PWA cache awareness.
   - If the app exposes version in UI (Settings/manifest), keep it in sync with `package.json`.

═══════════════════════════════════════════════
PWA & OFFLINE-FIRST RULES
═══════════════════════════════════════════════

- All data must persist in IndexedDB via Dexie.js
- Use `useLiveQuery` for reactive data; never raw async in render
- Schema changes require Dexie version migrations
- Service Worker via `vite-plugin-pwa` with `registerType: 'autoUpdate'`
- Never assume network availability. All core features must work offline.
- Cache-first for static assets; only add network strategies if the project gains remote APIs
- **Excepción actual:** PRO + BYOK llama a Google Gemini (`gemini-flash-latest`, host `generativelanguage.googleapis.com`) desde el cliente. Workbox: `NetworkOnly` para ese host. Sin key / sin red = categorizador local. La key NUNCA va en `VITE_*`, Dexie ni backups.

═══════════════════════════════════════════════
DATA LAYER RULES (Dexie.js)
═══════════════════════════════════════════════

- Query patterns: always use `useLiveQuery` for components
- Batch operations: use `db.transaction()` for multi-table writes
- Computed fields: derive from transaction history, never store stale totals
- Indexes: always index fields used in `.where()` or `.filter()`
- IDs: use `uuid` for primary keys

═══════════════════════════════════════════════
STATE MANAGEMENT
═══════════════════════════════════════════════

- **Zustand** for UI state (toasts, modals, flags)
- **Dexie useLiveQuery** for persistent/reactive data
- **React Hook Form + Zod** for all forms
- Never duplicate DB data into Zustand; keep single source of truth

═══════════════════════════════════════════════
UI & LANGUAGE RULES
═══════════════════════════════════════════════

- UI text: **Spanish** (es-CO locale)
- Code (variables, functions, comments): **English**
- Currency: COP (Colombian Peso), formatted with `formatCurrency()`
- Design: Mobile-first, Tailwind CSS, dark mode support
- Icons: Lucide React

═══════════════════════════════════════════════
SECURITY & PRIVACY (offline app)
═══════════════════════════════════════════════

- Input validation with Zod on forms and backup import/export
- No analytics or telemetry without explicit justification
- Data stays on-device; do not add remote sync unless requested
- Optional Gemini: only description + category names leave the device, and only if the user pasted a Gemini API key (PRO)

═══════════════════════════════════════════════
PREFERRED LIBRARIES (new choices only)
═══════════════════════════════════════════════

Esta lista es el default al elegir una librería NUEVA para algo que el
proyecto aún no resuelve. No reemplaza ni cuestiona lo que ya está en
`package.json` y funcionando.

| Propósito | Librería preferida |
|---|---|
| Validaciones | zod |
| Fechas | Temporal |
| Tablas | tanstack-table |
| Auth | better-auth |
| Animaciones | motion |
| Tipografías | fontsource |
| Gráficas | chart.js |
| Estado global | zustand |
| Drag & drop | pragmatic-drag-and-drop |
| Estado en la URL | nuqs |

**En este repo**, el stack ya instalado en `.cursor/rules/architecture.mdc` manda
(p. ej. `date-fns` y `recharts` hoy; Temporal/chart.js solo si se migra a propósito).

═══════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════

**For code changes:**
1. Detect stack (flag if different from expected)
2. Show exact file path
3. Complete code block with imports
4. Brief comment explaining WHY
5. Documentation reminder if relevant

**For deprecations:**
```
⚠️ OUTDATED: [old] → [new]. Reason: [why]. Action: [what to update]
```

**For documentation:**
```
📚 DOCS UPDATE: [file] — [section] — [what to update]
```

**For version bumps:**
```
📦 VERSION: [old] → [new] ([PATCH|MINOR|MAJOR] — [reason])
```
