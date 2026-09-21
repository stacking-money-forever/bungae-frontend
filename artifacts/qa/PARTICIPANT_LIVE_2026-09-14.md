# 참가자 흐름 실연동 확인 — 2026-09-14

- 대상: 프론트엔드 `de21c76` 기반 `codex/participant-flow-evidence` 작업트리의 미커밋 변경. 백엔드 `dfa7a2e` 코드는 변경하지 않았다.
- 환경: Next.js 개발 서버 `127.0.0.1:3133`, `BUNGAE_API_ORIGIN=http://127.0.0.1:18083`; Spring Boot 백엔드와 일회성 PostgreSQL 16.4·Redis 7.2.5 컨테이너. 검증 후 서버와 컨테이너를 종료했다.
- 프론트엔드 주소 `/v1/*`를 통해 OTP 인증, 모임 생성(`201`), 참가 요청을 실행했다. 백엔드의 실제 경로는 `/api/v1/*`다.
- 390×844 Chromium 브라우저에서 첫 참가 요청만 네트워크 오류로 중단했다. 화면의 오류·재시도 버튼을 확인하고 다시 눌렀다. 요청 2회의 `Idempotency-Key`가 같았고 재시도 응답은 `200 JOINED`였다.
- 성공 후 ‘참여하기’가 사라지고 ‘모임 참여 취소하기’가 나타났다. 화면을 벗어났다 돌아온 뒤에도 동일했다. 가로 overflow는 없었다.
- PostgreSQL에서 해당 사용자·모임의 참가 행은 1개, 모임 `joined_count`는 1이었다. 별도 HTTP 재요청에서도 같은 키의 응답은 동일한 `participationId`를 반환했다.
- 회귀 검증: `npm test` 72개 파일·534개 테스트 통과, `npm run typecheck`, `npm run lint`, `npm run build` 통과.

첫 오류는 브라우저 네트워크 중단으로 만들었으며 백엔드 장애를 재현한 것은 아니다. 인증과 참가 성공·멱등성 응답은 실행 중인 백엔드 및 DB에서 확인했다. 배포 환경에는 `BUNGAE_API_ORIGIN` 설정이 필요하다.
