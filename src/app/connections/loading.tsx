import { ScreenLoading } from "@/components/screen-loading";

export default function ConnectionsLoading() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <ScreenLoading variant="list" />
      </div>
    </main>
  );
}
