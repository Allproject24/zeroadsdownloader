import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import DownloaderPage from '@/features/downloader/DownloaderPage';
import NotFound from '@/pages/not-found';
import type { ReactNode } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={DownloaderPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}
