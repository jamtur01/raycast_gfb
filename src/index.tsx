import { List, ActionPanel, Action, showToast, Toast, Color, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { fetchLeagueMatches } from "./fetchLeagueMatches";
import { buildLeagueLogoUrl, buildTeamLogoUrl } from "./utils/url-builder";
import { MatchItem } from "./types/matchTypes";

function formatDateTime(utcDateTime: Date) {
  const dateOptions: Intl.DateTimeFormatOptions = { year: "2-digit", month: "2-digit", day: "2-digit" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

  const formattedDate = utcDateTime.toLocaleDateString("en-US", dateOptions);
  const easternTime = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "America/New_York" }).format(
    utcDateTime,
  );

  return `${formattedDate} at ${easternTime}`;
}

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

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

  const groupedMatches = groupMatchesByLeague(matches);

  return (
    <List>
      {Object.entries(groupedMatches).map(([leagueName, matches], leagueIndex) => (
        <List.Section key={leagueIndex} title={leagueName}>
          {matches.map((match, matchIndex) => (
            <MatchItem key={matchIndex} match={match} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function groupMatchesByLeague(matches: MatchItem[]): Record<string, MatchItem[]> {
  return matches.reduce((acc: Record<string, MatchItem[]>, match: MatchItem) => {
    (acc[match.leagueName] = acc[match.leagueName] || []).push(match);
    return acc;
  }, {});
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
  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={formatDateTime(new Date(match.status.utcTime))}
      accessories={[
        {
          icon: buildLeagueLogoUrl(match.leagueId, "dark"),
          tag: match.leagueName,
          tooltip: match.leagueName,
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
        tintColor: Color.Green,
      };
    case "cancelled":
      return {
        source: Icon.XMarkCircleFilled,
        tintColor: Color.Red,
      };
    case "today":
      return {
        source: Icon.AlarmRinging,
        tintColor: Color.Yellow,
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
