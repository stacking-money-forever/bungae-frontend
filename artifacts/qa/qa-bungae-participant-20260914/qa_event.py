#!/usr/bin/env python3
"""Task-local wrapper for linked app-QA action results and checkpoints."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


EVIDENCE_TOOL = Path("/Users/justn/.agents/skills/app-qa/scripts/evidence.py")


def record(output, worker, contract, phase, action, status, fields=(), evidence=()):
    command = [
        sys.executable, str(EVIDENCE_TOOL), "append", "--output", str(output),
        "--worker", worker, "--contract", str(contract), "--phase", phase,
        "--action", action, "--status", status,
    ]
    for field in fields:
        command.extend(("--field", field))
    for path in evidence:
        command.extend(("--evidence", path))
    return json.loads(subprocess.check_output(command, text=True))


def events(output, worker):
    path = output / ("worker-%s.jsonl" % worker)
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("begin", "end", "finish", "critic-setup"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--worker", required=True)
    parser.add_argument("--contract", type=Path, default=os.environ.get("OMP_ROLE_CALLBACK_RECEIPT"))
    parser.add_argument("--phase", default="dom")
    parser.add_argument("--action")
    parser.add_argument("--status", choices=("success", "failed", "blocked"))
    parser.add_argument("--observed")
    parser.add_argument("--evidence", action="append", default=[])
    parser.add_argument("--queue-remaining", type=int)
    parser.add_argument("--next-case-ids", default="none")
    parser.add_argument("--core-flow-status", choices=("tested-pass", "tested-fail", "blocked"))
    parser.add_argument("--core-flow-evidence-id")
    parser.add_argument("--completion-scope", choices=("qa-complete", "partial"))
    parser.add_argument("--blind-notes")
    parser.add_argument("--oracle-sources")
    parser.add_argument("--unsupported-claims")
    args = parser.parse_args()

    if not args.contract or not args.contract.is_file():
        parser.error("a real launcher receipt is required")
    args.output = args.output.resolve(strict=True)
    receipt = json.loads(args.contract.read_text())
    if receipt.get("agent") != args.worker or Path(receipt.get("evidence_root", "")).resolve() != args.output:
        parser.error("worker or evidence root does not match launcher receipt")
    pending_path = args.output / ("pending-%s.json" % args.worker)

    if args.mode == "critic-setup":
        if receipt.get("role") != "qa_critic" or events(args.output, args.worker):
            parser.error("critic setup requires an empty critic journal")
        if not args.blind_notes or not args.oracle_sources or not args.unsupported_claims:
            parser.error("critic setup requires first judgment and oracle audit fields")
        blind = record(args.output, args.worker, args.contract, "blind", "first-impression", "success", (
            "blind_notes=%s" % args.blind_notes,
        ))
        audit = record(args.output, args.worker, args.contract, "preflight", "oracle-audit", "success", (
            "oracle_sources=%s" % args.oracle_sources,
            "oracle_provenance=runtime-assertion",
            "unsupported_claims=%s" % args.unsupported_claims,
        ))
        print(json.dumps({"blind_note_id": blind["id"], "oracle_audit_id": audit["id"]}))
        return

    if args.mode == "begin":
        if not args.action or pending_path.exists():
            parser.error("begin requires an action and no pending action")
        completed = sum(bool(event.get("attempt_id")) for event in events(args.output, args.worker))
        if completed >= receipt["qa_limits"]["action_budget"]:
            parser.error("action budget exhausted")
        if receipt.get("role") == "qa_critic" and args.phase == "dom":
            recorded = events(args.output, args.worker)
            if not any(event.get("blind_notes") and event.get("phase") == "blind" for event in recorded):
                parser.error("critic DOM action requires a prior blind note")
            if not any(event.get("action") == "oracle-audit" and event.get("status") == "success"
                       for event in recorded):
                parser.error("critic DOM action requires a prior oracle audit")
        event = record(args.output, args.worker, args.contract, args.phase, args.action, "attempted")
        pending_path.write_text(json.dumps({"id": event["id"], "action": args.action, "phase": args.phase}))
        print(json.dumps({"attempt_id": event["id"], "action": args.action}))
        return

    if args.mode == "end":
        if not pending_path.exists() or not args.status or args.queue_remaining is None \
                or args.queue_remaining < 0 or not args.observed:
            parser.error("end requires a pending action, status, observation, and nonnegative queue count")
        pending = json.loads(pending_path.read_text())
        fields = ["attempt_id=%s" % pending["id"], "observed=%s" % args.observed]
        result = record(args.output, args.worker, args.contract, pending["phase"],
                        pending["action"], args.status, fields, args.evidence)
        pending_path.unlink()
        completed = sum(bool(event.get("attempt_id")) and event["status"] in
                        ("success", "failed", "blocked") for event in events(args.output, args.worker))
        budget = receipt["qa_limits"]["action_budget"]
        checkpoint = record(args.output, args.worker, args.contract, "control", "checkpoint", "success", (
            "completed_actions=%d" % completed,
            "remaining_action_budget=%d" % (budget - completed),
            "queue_remaining=%d" % args.queue_remaining,
            "next_case_ids=%s" % args.next_case_ids,
            "evidence_summary=%s %s" % (pending["action"], args.status),
        ))
        print(json.dumps({"result_id": result["id"], "checkpoint_id": checkpoint["id"],
                          "completed_actions": completed, "remaining_action_budget": budget - completed}))
        return

    if pending_path.exists() or args.queue_remaining is None or args.queue_remaining < 0 or not args.core_flow_status \
            or not args.core_flow_evidence_id or not args.completion_scope:
        parser.error("finish requires no pending action and complete verdict fields")
    valid_results = {event["id"] for event in events(args.output, args.worker)
                     if event.get("attempt_id") and event["status"] in ("success", "failed")}
    if args.core_flow_evidence_id not in valid_results:
        parser.error("core-flow evidence ID is not a linked result in this run")
    verdict = record(args.output, args.worker, args.contract, "report", "coverage-verdict", "success", (
        "core_flow_status=%s" % args.core_flow_status,
        "core_flow_evidence_ids=%s" % args.core_flow_evidence_id,
        "completion_scope=%s" % args.completion_scope,
        "queue_remaining=%d" % args.queue_remaining,
    ))
    print(json.dumps({"verdict_id": verdict["id"]}))
    command = [sys.executable, str(EVIDENCE_TOOL), "validate", "--output", str(args.output),
               "--worker", args.worker, "--contract", str(args.contract)]
    raise SystemExit(subprocess.call(command))


if __name__ == "__main__":
    main()
