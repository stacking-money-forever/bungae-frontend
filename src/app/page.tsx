import { Suspense } from "react";

import {
  defaultHomeFilters,
  HomeSurface,
  HomeSurfaceFromSearch,
} from "@/components/home-surface";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSurface filters={defaultHomeFilters} />}>
      <HomeSurfaceFromSearch />
    </Suspense>
  );
}
