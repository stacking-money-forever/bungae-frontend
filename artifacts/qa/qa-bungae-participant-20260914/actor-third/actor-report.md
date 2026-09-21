# Actor QA Report

## Verdict
- Scope: partial; core join flow tested-pass.
- Evidence validator: `valid=true` (49 events), verdict `af01b8064bee4de3a0a2cfce8e5a13c7`.
- Launcher receipt: `/private/var/folders/zx/s5045rsj1c95h7s0qw937gpm0000gn/T/omp-role-bungae-participant-blind-qa-third-20260914-r87s9fl6/.omp-role/bungae-participant-blind-qa-third-20260914-61f47329/launcher-receipt.json`
- Exact selector: `openai-codex/gpt-5.6-luna:medium`; automatic fallback disabled.
- Limits: 18 browser actions, checkpoint every action, 900s runtime, 180s silence, one restart permitted (unused).

## Tested
- Signed-out home visibly presented the 24-hour / 2 km context and login gate.
- Synthetic QA phone login reached the OTP screen; the supplied QA code completed authentication.
- Authenticated discovery showed one current disposable QA meetup.
- Meetup detail showed a free, alcohol-free walking meetup within the visible 24-hour window, public location, and capacity 1/4 before joining.
- Join succeeded: visible completion status, `OPEN`, count changed to 2/4, and action changed to cancel participation.
- Reload returned to a visible login-required state rather than the participation detail. This is observed behavior only; no business defect claim is made because no independent session-persistence oracle was supplied.
- Re-login recovery controls were reachable; a second OTP request visibly entered an in-progress state.

## Skipped / unvisited
- Completing the recovery OTP after reload: remaining action budget was insufficient after the OTP request remained in progress.
- Confirmation that participation detail reappears after re-authentication.
- Keyboard-only, narrow viewport, filter changes, invalid input, and cancellation were not exercised due to the bounded action budget.
- Screenshot visual evidence was not captured: the Ego screenshot API timed out twice/runner failed; semantic visible snapshots were retained as tool observations. No visual defect claim is made.

## Observed vs interpretation
- Observed: join confirmation and participant count visibly updated.
- Interpretation: the join transaction appears accepted and the detail screen exposes the participant state.
- Observed: reload required login.
- Interpretation: reload persistence of the authenticated session was not demonstrated in this isolated runtime; participation persistence remains unverified after re-authentication.

## Friction / risk
- Runner friction: the documented package import failed once; retrying the global Ego runtime succeeded. Screenshot capture timed out.
- The main residual risk is post-reload recovery and state redisplay. The core join interaction itself passed visibly.
