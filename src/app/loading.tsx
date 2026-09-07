import { ScreenLoading } from "@/components/screen-loading";

/**
 * Root route chunk/render pending. Static skeleton only; no fake titles,
 * member counts, results, or preset account state.
 */
export default function RootLoading() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <ScreenLoading variant="list" />
      </div>
    </main>
  );
}
