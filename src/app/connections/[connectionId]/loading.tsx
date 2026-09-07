import { ScreenLoading } from "@/components/screen-loading";

export default function ConnectionDetailLoading() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <ScreenLoading variant="conversation" />
      </div>
    </main>
  );
}
