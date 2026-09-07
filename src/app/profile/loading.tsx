import { ScreenLoading } from "@/components/screen-loading";

export default function ProfileLoading() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <ScreenLoading variant="list" />
      </div>
    </main>
  );
}
