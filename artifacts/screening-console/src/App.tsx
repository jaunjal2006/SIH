import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router as WouterRouter, Switch, useParams } from 'wouter';
import { Shell } from '@/components/Shell';
import Overview      from '@/pages/Overview';
import NewScreening  from '@/pages/NewScreening';
import Report        from '@/pages/Report';
import History       from '@/pages/History';
import AnalyticsPage from '@/pages/Analytics';
import Settings      from '@/pages/Settings';
import NotFound      from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function ScreeningReport() {
  const { id } = useParams<{ id: string }>();
  return <Report id={Number(id)} />;
}

function Routes() {
  return (
    <Shell>
      <Switch>
        <Route path="/"               component={Overview}      />
        <Route path="/screening/new"  component={NewScreening}  />
        <Route path="/screening/:id"  component={ScreeningReport} />
        <Route path="/history"        component={History}       />
        <Route path="/analytics"      component={AnalyticsPage} />
        <Route path="/settings"       component={Settings}      />
        <Route                        component={NotFound}      />
      </Switch>
    </Shell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') ?? ''}>
        <Routes />
      </WouterRouter>
    </QueryClientProvider>
  );
}
