# Actor-visible QA handoff (sanitized)

Source: QA preview at frontend revision `de21c76e1f7afd99b15fd75e3f5e6ac15f21dfe9`. Actor's report is `actor-report.md`; the contracted journal validated with 49 events. This handoff contains no phone number, verification code, or browser session data. It is an Actor observation, not an independent oracle.

| Result ID | Visible action/result |
| --- | --- |
| `8ecc40af936941708c088b2a4fb73aed` | After synthetic sign-in, opening a free small meetup showed 1/4 participants. Joining displayed completion, `OPEN`, 2/4, and an action to cancel participation. |
| `fe52037ee502474191b29c8e0e3e8935` | Reload of the detail route showed a login requirement, not the participation detail. |
| `227eb1d322fa4302947eb2e3fcaf0568` | Re-login phone submission entered an in-progress state; the Actor did not finish re-authentication within its action budget. |

Actor also reached the home/login/OTP screens. Two screenshot captures failed or timed out in the browser runner; no visual screenshot claim is available. Keyboard-only, narrow viewport, cancellation, and participation redisplay after re-login remain untested. Treat session persistence and backend transaction truth as unproven until independently verified.
