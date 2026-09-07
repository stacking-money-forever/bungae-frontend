# WIP

## 현재 상태

참가자용 모바일 프론트엔드 22개 라우트와 주요 로컬 상태 흐름이 구현되어 있다. 홈은 공개 장소·활동 사진을 사용하는 2열 그리드이며, 필터는 같은 fixture에서 결과 수와 실제 카드를 계산한다.

공통 앱 셸은 고정 헤더, 하단 내비게이션·하단 액션 elevation, 탭 좌우 드래그, 상세 화면 오른쪽 스와이프 뒤로가기를 제공한다. 생성 화면은 시간 휠·공개 장소 선택·24시간/시간 순서/인원 검증을 제공하고, 상세 화면은 실제 신고·차단 로컬 상태 흐름을 제공한다.

백엔드 API는 연결하지 않았다. [API_CONTRACT.md](docs/API_CONTRACT.md)는 구현 화면과 명세를 연결한 제안 계약이며, 서버에 엔드포인트가 존재한다는 의미가 아니다.

## 검증 기준선

- `npm test -- --reporter=dot`: 23 files, 92 tests 통과
- `npm run typecheck`: 통과
- `npm run lint`: 경고 없이 통과
- `npm run build`: 통과
- 생성 정적 HTML Anti-slop: 9 files, severity 0
- 22/22 라우트: 390px 제품 셸, 실제 가로 스크롤 0, 콘솔·page error 0
- 핵심 화면 4개: Playwright 390×844 캡처 및 육안 검사 완료

세부 증거는 [artifacts/qa/QA_TRANSCRIPT.md](artifacts/qa/QA_TRANSCRIPT.md)에 있다.

## 남은 확인

- 실제 iOS/Android 손가락 입력으로 하단 탭 드래그 임계값·취소·세로 스크롤 충돌 확인
- 디자인 저장소의 기존 `썸네일 없음` 기준을 승인된 홈 그리드 방향과 동기화
- API 계약의 미해결 결정 `D-01`~`D-16` 확정 후 백엔드 구현·연동
- Next가 포함한 PostCSS 취약점 해결을 위한 Next 16 메이저 업그레이드 별도 검토

커밋과 푸시는 사용자가 명시적으로 요청할 때만 수행한다.
