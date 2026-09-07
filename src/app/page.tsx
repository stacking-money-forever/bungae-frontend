import { Suspense } from "react";

import {
  defaultHomeFilters,
  HomeChrome,
  HomeSurfaceFromSearch,
} from "@/components/home-surface";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="app-viewport">
          <div className="home-shell">
            <HomeChrome filters={defaultHomeFilters} />
          </div>
        </main>
      }
    >
      <HomeSurfaceFromSearch />
    </Suspense>
  );
}
