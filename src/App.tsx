import { Suspense, lazy, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { MarketOverviewPage } from "./pages/MarketOverviewPage";
import { ScannerPage } from "./pages/ScannerPage";
import { useMarketStore } from "./store/useMarketStore";

// Both of these pull in Plotly (via RrgChart) for the RRG visualization --
// lazy-loaded so that weight only gets fetched when someone actually opens
// an RRG-bearing page, not on the initial Market Overview load.
const EtfDetailPage = lazy(() => import("./pages/EtfDetailPage").then((m) => ({ default: m.EtfDetailPage })));
const RrgAnalysisPage = lazy(() => import("./pages/RrgAnalysisPage").then((m) => ({ default: m.RrgAnalysisPage })));
// The backtest engine + strategy UI are sizeable and only needed once someone opens this page.
const StrategyBuilderPage = lazy(() => import("./pages/StrategyBuilderPage").then((m) => ({ default: m.StrategyBuilderPage })));
const AssistantPage = lazy(() => import("./pages/AssistantPage").then((m) => ({ default: m.AssistantPage })));

export default function App() {
  const load = useMarketStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<MarketOverviewPage />} />
          <Route
            path="rrg"
            element={
              <Suspense fallback={<PageFallback />}>
                <RrgAnalysisPage />
              </Suspense>
            }
          />
          <Route path="scanner" element={<ScannerPage />} />
          <Route
            path="strategy"
            element={
              <Suspense fallback={<PageFallback />}>
                <StrategyBuilderPage />
              </Suspense>
            }
          />
          <Route
            path="etf/:symbol"
            element={
              <Suspense fallback={<PageFallback />}>
                <EtfDetailPage />
              </Suspense>
            }
          />
          <Route
            path="assistant"
            element={
              <Suspense fallback={<PageFallback />}>
                <AssistantPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function PageFallback() {
  return <div className="text-sm text-ink-muted">Loading…</div>;
}
