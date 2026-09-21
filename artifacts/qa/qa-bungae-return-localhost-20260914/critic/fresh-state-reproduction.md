# Fresh-state reproduction evidence

- Fresh isolated Ego Lite TaskSpace: critic-owned space 6.
- Fresh synthetic identity: separate handoff identity; credential values omitted.
- Route before reload: authenticated meetup detail route for the disposable QA meetup.
- Action: reload the authenticated meetup detail.
- Observed: same meetup URL remained, but the page showed `로그인하고 모임을 확인해 주세요` and `휴대전화로 로그인하기` instead of meetup details.
- Follow-up: keyboard-submitted reauthentication returned to app home, not the original meetup URL.
- Comparison state: Actor handoff core-flow result `1f5f56a0f5514ddb97207f23f2f5ad96` is a distinct prior run and is not treated as the oracle.
- Oracle: human-approved QA acceptance conditions recorded in the critic `oracle-audit` event.
