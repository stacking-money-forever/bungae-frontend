# Critic first judgment — bungae local meetup-detail return mechanism

Critic: `qa-bungae-ds-20260914` · role `qa_critic` · selector `workbuddy/deepseek-v4.1-flash:medium`
Target: `http://localhost:3117` · source revision `de21c76e1f7afd99b15fd75e3f5e6ac15f21dfe9`
Evidence root: `/Users/justn/dev/.worktrees/bungae-frontend-participant-flow/artifacts/qa/qa-bungae-return-localhost-20260914/critic-deepseek`
Run id: `fff2cd606926452084840ef74d73670f` · restart_index 0 / max_restarts 1
Limits: runtime 900s, silence 180s, action budget 20, checkpoint_every 1

Written before any browser or DOM inspection. This file carries the readback and
preflight; neither is recorded as a journal event, because `qa_event.py critic-setup`
requires an empty critic journal and `evidence.py validate` enforces
readback/preflight gates only for the `qa`/`qa_actor` roles. The critic journal
therefore begins with `critic-setup` (one blind note, one oracle-audit), followed
by `begin`/`end` browser actions.

## Understanding readback

- **Scenario.** Independent Critic check of the local meetup-detail return
  mechanism on `http://localhost:3117` with QA-2, a synthetic meetup organizer
  account. I open QA-2's current meetup detail through visible navigation, record
  the visible organizer state/action, reload, use the visible login control,
  reauthenticate, and check whether the SAME detail URL and the SAME organizer
  state/action are restored.
- **Constraints.** Exactly one fresh isolated Ego Lite TaskSpace and the QA-2
  account. Read only `phone_number` and `qa_code` from the supplied handoff JSON;
  ignore `preview_url`; never print authentication values. `page.goto` is used
  only for the initial supplied URL — every later route change must come from a
  visible link/button or keyboard action, never `goto` or direct URL assignment.
  Every observed page origin must remain `http://localhost:3117`. Disposable QA
  data only; no payments, messages, publication, app edits, or external account
  changes. QA-2 is an organizer, not the Actor's participant, so my result is a
  route/state-restoration check for an organizer role and is not evidence about
  the participant-specific action. First judgment precedes all browser and DOM
  inspection, and no Actor screenshot is treated as valid.
- **Stop conditions.** Stop after the contracted organizer return check
  (navigate, record, reload, reauthenticate, compare URL and state). Stop
  immediately and record the exact visible response if OTP rate limiting
  appears, without exceeding the OTP requests this scenario requires. Stop on
  Ego Lite unavailability, real user takeover, or action-budget exhaustion.
- **Unknowns.** Whether reload clears an organizer session the way it did for the
  Actor's participant account; whether the login control is reachable from the
  logged-out detail view; whether reauthentication returns to the identical
  detail URL; whether the visible organizer action set is stable across the
  reload boundary; whether screenshot capture and viewing work in this runtime.
- **Alignment.** `matched`. The prompt frames this as verification of the shared
  organizer return mechanism, not a participant-specific claim; that matches my
  reading and is how I will report it.

## Feasibility preflight

- **Core flow.** Initial `goto` to the supplied URL, then visible navigation to
  QA-2's current meetup detail; record the visible organizer state/action; reload
  the same page; observe the logged-out state; use the visible login control and
  reauthenticate with the QA-2 phone/code; compare the resulting URL and
  organizer state/action against the pre-reload record.
- **Data state.** QA-2 synthetic organizer account from the handoff JSON; its
  current meetup must already exist so a detail route is reachable by visible
  navigation. This run creates no state. If QA-2 owns no visible meetup detail,
  the core flow cannot be exercised and the run reports blocked rather than
  inventing a target.
- **Oracle.** `oracle_type=executable`,
  `oracle_ref=visible local navigation and meetup state transitions`,
  `oracle_provenance=runtime-assertion`: same-origin URL equality before and after
  reauthentication, plus reappearance of the previously recorded visible
  organizer state/action.
- **Uncreatable states.** Participant-role state (different account), backend or
  database truth, human comprehension; forced/bypassed OTP rate limiting;
  guaranteed screenshot capture if the runtime times out.
- **Shortest credible flow check.** One login session + one detail route + one
  reload + one reauthentication are all reachable with the supplied QA-2 account
  in the one contracted TaskSpace, so the preflight is feasible without creating
  new data.

## First judgment (blind — sanitized Actor handoff only)

Evidence read: `artifacts/qa/qa-bungae-return-localhost-20260914/actor/actor-visible-sanitized.md`.
No raw Actor evidence, earlier QA report, source, bundle, private store, browser
token, or undocumented API was read; no Actor screenshot is used.

- **Observed (as reported by the Actor, not independently by me).** A joined
  synthetic account showed one current meetup with `OPEN` and
  `모임 참여 취소하기`. Reloading its detail URL showed `로그인 필요` and withheld
  details. Visible phone/code re-authentication returned to that same meetup URL
  with `OPEN` and `모임 참여 취소하기` reappearing. Keyboard activation worked;
  two pointer attempts were intercepted by visible navigation or overlay layers
  with no confirmed root cause. At 390×844 the detail semantics stayed reachable;
  screenshot capture timed out, so no screenshot-based visual claim exists.
- **Interpretation.** The handoff describes a coherent session-expiry-then-return
  loop: an authenticated deep route, a reload that drops the session and withholds
  content, then reauthentication that lands back on the same detail route with the
  same action set. The mechanism is reported at the participant role only, so
  whether it is shared across roles is exactly the open question I am asked to
  test. The two intercepted pointer attempts read as a plausible overlay or
  navigation race rather than a functional break, but the Actor explicitly did
  not establish a root cause, so I treat it as unexplained and not a defect.
- **Friction (subjective).** If a reload of a detail URL silently discards an
  authenticated session, that is a real interruption for a returning organizer;
  the recovery path must be obvious and must return the user to the same object.
  A return that lands on a generic list instead of the same detail would be worse
  than the reload itself. I also note the handoff gives me no independent ground
  truth — it is not an oracle, and agreement between us would not by itself
  establish anything.
- **What I will test.** Whether the same URL and the same visible organizer
  state/action are restored after reload and reauthentication, using QA-2 and
  visible navigation only.
- **What I will not claim.** Backend truth, the participant-specific action, human
  comprehension, and visual geometry without a screenshot.
