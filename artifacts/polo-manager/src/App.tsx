import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import { Home } from "@/pages/spectator/Home";
import { TournamentsPage } from "@/pages/spectator/Tournaments";
import { TournamentDetail } from "@/pages/spectator/TournamentDetail";
import { MatchDetail } from "@/pages/spectator/MatchDetail";
import { ClubsPage } from "@/pages/spectator/Clubs";
import { ClubDetail } from "@/pages/spectator/ClubDetail";
import { PlayersDirectory } from "@/pages/spectator/Players";
import { PlayerProfile } from "@/pages/spectator/PlayerProfile";
import { MyProfile } from "@/pages/MyProfile";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { AcceptInvite } from "@/pages/AcceptInvite";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminTournaments } from "@/pages/admin/Tournaments";
import { AdminTeams } from "@/pages/admin/Teams";
import { MatchDay } from "@/pages/admin/MatchDay";
import { MatchControl } from "@/pages/admin/MatchControl";
import { ScoreControl } from "@/pages/admin/ScoreControl";
import { StatsControl } from "@/pages/admin/StatsControl";
import { GFXControl } from "@/pages/admin/GFXControl";
import { ShareControl } from "@/pages/share/ShareControl";
import { ScoreboardShare } from "@/pages/share/ScoreboardShare";
import { AdminUsers } from "@/pages/admin/Users";
import { AdminClubs } from "@/pages/admin/Clubs";
import { AdminPlayers } from "@/pages/admin/Players";
import { PlayerManage } from "@/pages/admin/PlayerManage";
import { ClubSettings } from "@/pages/admin/ClubSettings";
import { AiWizard } from "@/pages/admin/AiWizard";
import { MatchGraphics } from "@/pages/admin/MatchGraphics";
import { TeamDashboard } from "@/pages/my-team/Dashboard";
import { OutDates } from "@/pages/my-team/OutDates";
import { TeamSchedule } from "@/pages/my-team/Schedule";
import { ScoreBugOverlay } from "@/pages/broadcast/ScoreBugOverlay";
import { ScoreBugOverlay2 } from "@/pages/broadcast/ScoreBugOverlay2";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/clubs" component={ClubsPage} />
      <Route path="/clubs/:slug" component={ClubDetail} />
      <Route path="/tournaments" component={TournamentsPage} />
      <Route path="/tournaments/:id" component={TournamentDetail} />
      <Route path="/match/:id" component={MatchDetail} />
      <Route path="/players" component={PlayersDirectory} />
      <Route path="/players/:id" component={PlayerProfile} />
      <Route path="/my-profile" component={MyProfile} />
      <Route path="/accept-invite/:token" component={AcceptInvite} />

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/tournaments" component={AdminTournaments} />
      <Route path="/admin/teams" component={AdminTeams} />
      <Route path="/admin/matchday" component={MatchDay} />
      <Route path="/admin/match/:id/control">
        {(params) => <Redirect to={`/admin/score-control/${params.id}`} />}
      </Route>
      <Route path="/admin/score-control/:id" component={ScoreControl} />
      <Route path="/admin/stats-control/:id" component={StatsControl} />
      <Route path="/admin/gfx-control/:id" component={GFXControl} />
      <Route path="/possession/:matchId">
        {(params) => <Redirect to={`/admin/stats-control/${params.matchId}`} />}
      </Route>
      <Route path="/share/stats/:token">{() => <ShareControl pageType="stats" />}</Route>
      <Route path="/share/gfx/:token">{() => <ShareControl pageType="gfx" />}</Route>
      <Route path="/share/full_control/:token">{() => <ShareControl pageType="full_control" />}</Route>
      <Route path="/share/scoreboard/:token" component={ScoreboardShare} />
      <Route path="/admin/match/:id/graphics" component={MatchGraphics} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/clubs" component={AdminClubs} />
      <Route path="/admin/club-settings" component={ClubSettings} />
      <Route path="/admin/ai-wizard" component={AiWizard} />
      <Route path="/admin/players" component={AdminPlayers} />
      <Route path="/admin/players/:id" component={PlayerManage} />

      <Route path="/my-team" component={TeamDashboard} />
      <Route path="/my-team/:teamId" component={TeamDashboard} />
      <Route path="/my-team/:teamId/out-dates" component={OutDates} />
      <Route path="/my-team/:teamId/schedule" component={TeamSchedule} />

      <Route component={NotFound} />
    </Switch>
  );
}

function BroadcastRouter() {
  return (
    <Switch>
      <Route path="/broadcast/scorebug/:matchId" component={ScoreBugOverlay} />
      <Route path="/broadcast/channel/:clubId/:channel" component={ScoreBugOverlay} />
      <Route path="/broadcast/scorebug2/:matchId" component={ScoreBugOverlay2} />
    </Switch>
  );
}

function AppContent() {
  const path = window.location.pathname;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const relativePath = basePath ? path.replace(basePath, "") : path;
  
  if (relativePath.startsWith("/broadcast/")) {
    return <BroadcastRouter />;
  }

  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
