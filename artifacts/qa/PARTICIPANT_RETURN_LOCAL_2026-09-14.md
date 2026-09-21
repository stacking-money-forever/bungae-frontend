# 참가자 인증 복귀 · 로컬 검증

대상은 `codex/participant-flow-evidence`의 `de21c76e1f7afd99b15fd75e3f5e6ac15f21dfe9` 위 미커밋 변경이다. QA용 Next.js 개발 서버 `http://localhost:3117`은 `BUNGAE_API_ORIGIN=https://bungae-qa.justn.me`로 실행했다. 로컬 `/`는 200, 미인증 `/v1/meetups`는 백엔드 401이었다. 기존 Vercel 미리보기에는 이 인증 복귀 수정이 배포되지 않았다.

## 코드·테스트 기준

- `src/app/auth/page.tsx` SHA-256: `96705839488d840e7b570c27cefc9b444565ecd32e4e71a0fb5e351b7a5732d4`
- `src/app/meetups/[meetupId]/page.tsx` SHA-256: `7dbd06dd2205c2a67370f90310737b3c42700a15ab90897510e50bf6d370cdd1`
- `next.config.ts` SHA-256: `ab8ab2a0ce7053f979d0f76b5d4de1bd6ac1d73b3b83ead4a659f8edd23f5249`
- 인증 뒤 상세 복귀와 외부/비허용 URL 거부를 추가한 뒤 `npm test` 540개, `npm run typecheck`, `npm run lint`, `npm run build`가 통과했다. 기존 인메모리 인증 정책은 바꾸지 않았다.

## 실제 화면 근거

- [참가자 Actor](qa-bungae-return-localhost-20260914/actor/actor-report.md): 별도 합성 QA-3 계정에서 새로고침→로그인 요구→재인증→같은 모임 상세·`OPEN`·`모임 참여 취소하기` 복귀를 관찰했다. 계약 저널 55건 유효.
- [주최자 DeepSeek Critic](qa-bungae-return-localhost-20260914/critic-deepseek/critic-report.md): 별도 QA-2 계정에서 같은 상세 URL과 주최자 상태·동작 복귀를 독립 확인했다. `workbuddy/deepseek-v4.1-flash`, 계약 저널 42건 유효.
- [참가자 DeepSeek Critic](qa-bungae-return-localhost-20260914/critic-participant-deepseek/critic-report.md): 전화번호별 1시간 5회 OTP 제한 창이 지난 뒤 별도 QA-1 계정으로 재실행했다. 새로고침→재인증 후 같은 모임 URL, `OPEN`, `모임 참여 취소하기`가 모두 복원됐다. `workbuddy/deepseek-v4.1-flash`, 계약 저널 39건 유효. 제한을 낮추거나 기록을 지우지 않았다.

`127.0.0.1` 주소에서의 첫 QA는 Next 개발 리소스 교차 출처 차단으로 인증 폼이 기본 GET 제출됐다. 그 결과를 앱 결함으로 세지 않고 `localhost`에서 새 격리 브라우저로 재실행했다. Ego의 `Page.captureScreenshot`은 Actor/Critic 모두 시간 초과였으므로 시각적 레이아웃 완료 근거는 없다. 모든 계정·모임은 격리 QA 데이터이며 실제 사람 관찰은 0건이다.
