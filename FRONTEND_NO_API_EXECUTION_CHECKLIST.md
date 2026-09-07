# Frontend no-API execution checklist

Source plan: `.omp-role/reports/frontend-100-no-api-plan.md`.

This checklist defines **frontend presentation, recovery, accessibility, and
verification completion only**. It does not authorize API/client transport,
backend, provider, deployment, or device-account changes. A missing contract
must render an honest unavailable state; it must never be replaced by a local
success, fixture, or inferred identity.

## T01 — route children and honest navigation shell

- [x] Make the root tabs render real route children once, with direct URL,
  back/forward, filter apply/cancel, and focus behavior preserved.
- [x] Remove production fixture/query-driven success/count surfaces from the
  shell without changing API wiring.
- [x] Add route-shell regressions and run focused tests, then typecheck.

## T02 — recovery, loading, identity, and accessibility foundation

- [x] Add global/family error boundaries, `not-found`, reset/retry recovery,
  and privacy-safe disabled telemetry abstraction.
- [x] Add segment Suspense/loading skeleton rules that never suspend again.
- [x] Add shared route/session identity isolation for stale drafts, receipts,
  errors, pending state, dialogs, and scroll, with home/detail consumers and
  focus/Escape/live-region/reduced-motion coverage. Route-family rollout is
  T03/T04 ownership.

## T03 — non-chat route state completeness

- [x] T03a: auth/profile account surfaces consume shared session identity,
  expose honest offline/unavailable states, preserve drafts, and suppress
  same-subject re-login stale state.
- [x] T03b: non-chat meetup action and post-meetup surfaces consume shared
  identity, distinguish unavailable/offline/unknown states, preserve drafts,
  and never claim a receipt before an adapter response.
- [x] Complete applicable default/loading/empty/error/retry/disabled/unknown
  states, validation, focus, and stale-state suppression for auth, profile,
  meetup actions, feedback, my-meetups, and notifications.
- [x] T03c: complete my-meetups and notifications without inventing
  unavailable API facts.

## T04 — connections and chat presentation state machines

- [x] Add connection-detail unavailable/recovery UI and presentation-only
  conversation state machines for group and 1:1 chat.
- [x] Cover IME, scroll/new-message presentation, draft retention, capability
  absence, revocation, and outcome-unknown without adding transport wiring.

## T05 — PWA, offline, and update UX

- [x] Complete install/unavailable/offline/update warning, dirty/pending
  protection, and one-time reload behavior without changing Push transport or
  private cache boundaries.
  - Evidence: `.omp-role/reports/frontend-no-api-t05-pwa.md` (offline retry
    document, once-reload hardening, dirty/pending confirm gate, install
    honesty; Push transport/private cache boundaries untouched).

## T06 — no-API E2E and visual/accessibility evidence

- [x] Add isolated, egress-denied test-only E2E harness outside production
  imports; retain Vitest boundaries.
  - Evidence: `.omp-role/reports/frontend-no-api-t06a-e2e.md` —
    `playwright.config.ts` (ports 3120/3121, `reuseExistingServer:false`),
    `playwright.harness.config.ts`, `e2e/fixtures/egress.ts`
    (`/v1/**`+`/api/**`+external deny, violation array asserted `[]` per test,
    SW blocked except pwa-chromium project), `vitest.config.mts` exclude,
    `test:e2e`/`test:e2e:pwa`/`test:e2e:harness` scripts. No
    `?mock=`/`NEXT_PUBLIC_MOCK`/hidden success route.
- [x] Verify actual Next routes, 390×844, 320px, 200% text, long ko/en,
  keyboard, reduced motion, and available assistive-technology evidence.
  - Evidence: `.omp-role/reports/frontend-no-api-t06b-qa.md` — real production
    build `next start`, 71 E2E (chromium/webkit/firefox + pwa-chromium),
    390×844/320×844/200% html font-size, keyboard-only reach, reduced-motion
    computed-style assertions, `.omp-role/evidence/fe-t06b/` screenshots.
    Real-device VoiceOver/TalkBack/iOS-Android PWA remain external gates
    (`DEVICE_EVIDENCE_PENDING`); WebKit emulation is not device evidence.

## T07 — evidence and final disposition

- [x] Record every route/surface result with source, state, command, and
  evidence; keep API/backend/device gaps explicitly external.
  - Evidence: `.omp-role/reports/frontend-no-api-t07-final.md` — 28 existing +
    1 new (`/connections/[connectionId]`) route inventory, global/family
    error/loading/not-found + PWA surfaces, FE/external two-register ledger.
- [x] Run final `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
  `git diff --check`, no-API E2E, and independent review before declaring the
  frontend-only DoD complete.
  - Evidence (2026-09-07, snapshot `e126c1fb`, base `cdf1328`): `npm test`
    71 files / 531 passed · `npm run typecheck` 0 errors · `npm run lint`
    0/0 · `npm run build` passed · `git diff --check` exit 0 ·
    `npm run test:e2e` 71 passed (chromium/webkit/firefox/pwa-chromium,
    retries 0) · API egress violation 0 · independent diff-ownership /
    fake-success / API-egress review in the T07 report.
