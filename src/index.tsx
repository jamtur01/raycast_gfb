import { List, ActionPanel, Action, showToast, Toast, Color, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { fetchLeagueMatches } from "./fetchLeagueMatches";
import { buildLeagueLogoUrl, buildTeamLogoUrl } from "./utils/urlBuilder";
import { sendNotification } from "./utils/sendNotifications";
import { formatDateTime } from "./utils/formatDateTime";
import { MatchItem } from "./types/matchTypes";

export default function MatchListCommand() {
  const {
    data: matches,
    isLoading,
    error,
  } = useCachedPromise(fetchLeagueMatches, [], {
    initialData: [],
    keepPreviousData: true,
  });

  if (error) {
    showToast(Toast.Style.Failure, "Failed to fetch matches", error.message);
  }

  if (isLoading && matches.length === 0) {
    return <List isLoading={true} />;
  }

  if (matches.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No Matches Found"
          description="No matches available for the selected leagues or teams."
        />
      </List>
    );
  }

  const todayMatches = matches.filter((match) => {
    const status = getMatchStatus(match.status);
    return status === "today" || status === "in-progress";
  });

  const otherMatches = matches.filter((match) => {
    const status = getMatchStatus(match.status);
    return status !== "today" && status !== "in-progress";
  });

  const groupedTodayMatches = groupMatchesByTournament(todayMatches as MatchItem[]);
  const groupedOtherMatches = groupMatchesByTournament(otherMatches as MatchItem[]);

  Object.entries(groupedTodayMatches).map(([tournamentName, matches]) => {
    matches.map((match: MatchItem) => {
      sendNotification(tournamentName, match);
    });
  });

  return (
    <List>
      {Object.entries(groupedTodayMatches).map(([tournamentName, matches], tournamentIndex) => (
        <List.Section key={tournamentIndex} title={`${tournamentName} - Today`}>
          {matches.map((match: MatchItem, matchIndex: number) => (
            <MatchItem key={matchIndex} match={match} />
          ))}
        </List.Section>
      ))}

      {Object.entries(groupedOtherMatches).map(([tournamentName, matches], tournamentIndex) => (
        <List.Section key={tournamentIndex} title={tournamentName}>
          {matches.map((match: MatchItem, matchIndex: number) => (
            <MatchItem key={matchIndex} match={match} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function groupMatchesByTournament(matches: MatchItem[]) {
  const now = new Date();

  return matches.reduce((acc: Record<string, MatchItem[]>, match: MatchItem) => {
    const tournamentName = match.tournament.name;
    if (!acc[tournamentName]) {
      acc[tournamentName] = [];
    }
    acc[tournamentName].push(match);

    acc[tournamentName].sort((a, b) => {
      const dateA = new Date(a.status.utcTime);
      const dateB = new Date(b.status.utcTime);

      const isPastA = dateA < now;
      const isPastB = dateB < now;

      if (isPastA && isPastB) {
        return dateB.getTime() - dateA.getTime();
      } else if (!isPastA && !isPastB) {
        return dateA.getTime() - dateB.getTime();
      } else {
        return isPastA ? 1 : -1;
      }
    });

    return acc;
  }, {});
}

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function getMatchStatus(status: MatchItem["status"]) {
  const { cancelled, finished, started, ongoing, utcTime } = status;

  if (cancelled) return "cancelled";
  if (finished) return "finished";
  if (started && ongoing) return "in-progress";
  if (!started && !cancelled && !finished && isToday(new Date(utcTime))) return "today";
  return "upcoming";
}

function MatchItem({ match }: { match: MatchItem }) {
  const status = getMatchStatus(match.status);
  const icon = getMatchIcon(status);
  const title = getMatchTitle(match, status);
  const actions = getMatchActions(match);
  const tournamentName = match.tournament.name;

  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={formatDateTime(new Date(match.status.utcTime))}
      accessories={[
        {
          icon: buildLeagueLogoUrl(match.tournament.leagueId, "dark"),
          tag: tournamentName,
          tooltip: tournamentName,
        },
        {
          icon: buildTeamLogoUrl(match.home.id),
        },
        {
          icon: buildTeamLogoUrl(match.away.id),
        },
      ]}
      actions={actions}
    />
  );
}

function getMatchIcon(status: string): Icon | { source: string; tintColor: Color } {
  switch (status) {
    case "finished":
      return {
        source: Icon.CheckCircle,
        tintColor: Color.Green,
      };
    case "in-progress":
      return {
        source: Icon.PlayFilled,
        tintColor: Color.Orange,
      };
    case "cancelled":
      return {
        source: Icon.XMarkCircleFilled,
        tintColor: Color.Red,
      };
    case "today":
      return {
        source: Icon.AlarmRinging,
        tintColor: Color.Magenta,
      };
    default:
      return {
        source: Icon.Calendar,
        tintColor: Color.Blue,
      };
  }
}

function getMatchTitle(match: MatchItem, status: string): string {
  return status === "finished" ? getFinishedMatchTitle(match) : `${match.home.name} vs ${match.away.name}`;
}

function getFinishedMatchTitle(match: MatchItem): string {
  const { home, away, winner, status } = match;
  const { name: homeName } = home;
  const { name: awayName } = away;
  const { reason: { short: statusShort } = {} } = status;

  if (!winner) {
    return `${homeName} vs ${awayName}`;
  }

  if (winner === homeName) {
    return `🏆 ${homeName} - ${awayName} (${statusShort ?? "FT"}) (${home.score} - ${away.score})`;
  }

  if (winner === awayName) {
    return `${homeName} - 🏆 ${awayName} (${statusShort ?? "FT"}) (${home.score} - ${away.score})`;
  }

  if (winner === "draw") {
    return `${homeName} 🤝 ${awayName} (${statusShort ?? "FT"}) (${home.score} - ${away.score})`;
  }

  return "";
}

function getMatchActions(match: MatchItem): JSX.Element {
  return (
    <ActionPanel>
      <Action.OpenInBrowser url={match.matchLink} title="Open Match Details" />
    </ActionPanel>
  );
}
