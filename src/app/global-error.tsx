"use client";

/**
 * Last-resort boundary for bootstrap/root-layout failures. It must not
 * depend on the auth provider, Motion, PWA islands, remote fonts, or any
 * app router hook — a failure in those would leave recovery broken too.
 * This file owns its own minimal document so the shell can re-render.
 */

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minWidth: 320,
          minHeight: "100svh",
          background: "#FBFAF7",
          color: "#161616",
          fontFamily: "sans-serif",
        }}
      >
        <main
          style={{
            display: "flex",
            minHeight: "100svh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          <h1
            id="global-error-heading"
            style={{ margin: 0, fontSize: 22, lineHeight: 1.4 }}
          >
            화면을 표시하지 못했어요
          </h1>
          <p
            style={{
              maxWidth: 300,
              margin: "12px auto 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#5F5F5F",
            }}
          >
            예상하지 못한 문제가 생겼어요. 입력한 내용은 저장되지 않았을 수
            있어요. 새로고침한 뒤에도 같은 문제가 계속되면 잠시 후 다시
            시도해 주세요.
          </p>
          <div
            style={{
              display: "flex",
              width: "100%",
              maxWidth: 280,
              flexDirection: "column",
              gap: 8,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 52,
                borderRadius: 12,
                border: 0,
                background: "#FFD60A",
                color: "#161616",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- last-resort boundary must not import next/link's app-router module graph */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid #E8E5DE",
                background: "#FFFFFF",
                color: "#161616",
                fontSize: 16,
                textDecoration: "none",
              }}
            >
              홈으로 돌아가기
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
