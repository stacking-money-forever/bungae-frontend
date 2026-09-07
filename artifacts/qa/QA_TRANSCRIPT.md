# Bungae frontend rollout QA — 2026-09-02

## Surface

- Worktree: `/Users/justn/dev/bungae-frontend-rollout`
- Branch/base: `codex/app-shell-rollout` from `759bf4a`
- Browser target: `http://127.0.0.1:3002`
- App shell: 390px; Aside host viewport: 1309×818
- Intended product viewport: 390×844
- Backend/network mutations: none

Aside could not override its host viewport to exactly 390×844. Every product shell was nevertheless measured at 390px, and its content wrapping/overflow was evaluated inside that shell. The four critical visual states were then recaptured at an exact 390×844 viewport with headless Playwright using the installed Chrome channel.

## Route matrix

- Routes checked: 22/22
- Visible route root: 22/22
- Product shell width: 390px on all `ScreenShell` and `.home-shell` surfaces
- Horizontal scroll overflow: 0/22
- Console errors: 0
- Page errors: 0
- `/meetups/demo/hub` had two intentionally oversized decorative map lines, both clipped by their container; shell `scrollWidth` remained 390px.

## Critical flows

| Flow | Evidence | Verdict |
| --- | --- | --- |
| Filter sheet keeps real home | Six real `.meetup-list-row` nodes remain under inert + `aria-hidden` background | Pass |
| Filter result consistency | Vitest covers activity filter: label 3 and visible rows 3; browser default shows six fixtures | Pass |
| Detail swipe back | Aside pointer drag on non-interactive detail content returned to home | Pass |
| Bottom-tab drag | Aside mouse path emitted browser `pointercancel`; a DOM PointerEvent sequence through the real page switched Explore → My Meetups | Degraded evidence |
| Creation form | Screenshot inspected; editable cards, start/end/deadline triggers, public place trigger, capacity fields and fixed CTA visible | Pass |
| Time wheel | 55 deterministic options, selected item focused, up/down listbox semantics observed | Pass |
| Report/block | Both 48px actions visible; report submit disabled until reason; dialog screenshot inspected | Pass |
| Reduced Motion | Unit/integration coverage uses actual Motion preference and zero-duration paths | Pass |

Gesture ownership is implemented in `src/components/navigation-gestures.ts`, `bottom-navigation.tsx`, and `page-transition.tsx`. Page back applies outside the three root tabs and ignores gestures starting from `a`, `button`, `input`, `select`, `textarea`, `summary`, dialog/button roles, and `[data-no-page-swipe]`. Filter state uses `activity`, `time`, `distance`, `costAlcohol`, and `available=1` query parameters; omitted values resolve to `defaultHomeFilters`.

Accessibility automation covers filter background `inert` + `aria-hidden`, dialog initial focus/focus trap/focus return, disabled submit states, picker listbox/option semantics, and Reduced Motion. A real screen-reader session was not run.

## Visual evidence

- `home-grid.jpeg`
- `filter-sheet.jpeg`
- `create-form.jpeg`
- `report-dialog.jpeg`
- `home-390x844.png`
- `filter-390x844.png`
- `create-390x844.png`
- `detail-390x844.png`

All eight captures were opened and inspected after capture. They are non-uniform rendered screenshots, not placeholder receipts. The black circular `N` control visible at the lower-left of development captures is the Next.js development indicator, not application UI.

## Automated verification

- `npm test -- --reporter=dot`: 23 files, 92 tests passed
- `npm run typecheck`: passed
- `npm run lint`: passed with zero warnings
- `npm run build`: passed
- `git diff --check`: passed
- Anti-slop on `.next/server/app`: nine generated static HTML documents passed, severity 0

## Known risk

- Aside's mouse automation cancels the bottom-nav pointer stream after its first move. The component and pure gesture threshold tests pass, and a real-page synthetic PointerEvent sequence commits the adjacent tab, but this is weaker than a physical touch transcript. Manual iOS/Android touch QA remains required before release.
- `npm audit` reports one moderate direct Next finding via PostCSS and one high transitive PostCSS finding. The available automated fix upgrades Next to 16.3.4 (semver major), so it was not applied in this rollout.
- The vulnerable nested package observed by `npm ls` is `next@15.5.24 → postcss@8.4.31`. No user-supplied CSS processing contract is implemented in this frontend, but that does not remove the dependency finding. Mitigation remains a separately tested Next major upgrade or an upstream patched dependency path.
- The canonical API follow-up and 16 unresolved decisions are in `docs/API_CONTRACT.md`, §18. The detail-screen block target was resolved to the meetup proposer user.

## Current-generation production refresh

After the review fixes, the authoritative clean build was served with `next start` on port 3002 and rechecked through Aside:

- Invalid `/filters?activity=NOPE&distance=garbage&available=2` normalized to visible defaults: `전체`, `2km 이내`, switch off, six background rows and `결과 6개 보기`.
- A home query for `activity=산책&available=1` preserved both values in the filter-entry href.
- Direct posted-result rendering used the current clock-derived label and selected place; it did not render `시간 미정` or a hard-coded 18:30 receipt.
- The report dialog exposed eight reasons, an urgent checkbox, reporter privacy copy, and `tel:112`/`tel:119` paths. `report-dialog-current.jpeg` records this state.
- Aside produced a real `pointercancel` during bottom-nav mouse drag. The first intentional notification-tab click immediately afterward rendered the Notifications screen, so cancellation no longer consumes the next click.
