import { ScreenLoading } from "@/components/screen-loading";

export default function MeetupLoading() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <ScreenLoading variant="detail" />
      </div>
    </main>
  );
}
