import { Cache, getPreferenceValues, List, ActionPanel, Action } from "@raycast/api";
import { useState, useEffect } from "react";
import Fotmob from "fotmob";
import { MatchData, MatchItem, Preferences } from "./types";

async function fetchLeagueMatches(): Promise<MatchData> {
  const prefs = getPreferenceValues<Preferences>();
  const startDateOffset = Number(prefs.startDateOffset) || 7;
  const endDateOffset = Number(prefs.endDateOffset) || 30;
  const currentDate = new Date();
  const startDate = new Date(currentDate.setDate(currentDate.getDate() - startDateOffset));
  const endDate = new Date(currentDate.setDate(currentDate.getDate() + endDateOffset));

  const interestedLeagues = getInterestedLeagues(prefs);
  const allMatches: MatchData = [];

  for (const [leagueId, teamId] of Object.entries(interestedLeagues)) {
    console.log(`Fetching matches for league ${leagueId} and team ${teamId}`);
    const matches = await getLeagueMatches(Number(leagueId), teamId, startDate, endDate);
    allMatches.push(...matches);
  }

  return allMatches;
}

function getInterestedLeagues(prefs: Preferences): Record<number, number> {
  const interestedLeagues: Record<number, number> = {};

  for (let i = 1; i <= 5; i++) {
    const leagueId = Number(prefs[`league${i}` as keyof Preferences]);
    const teamId = Number(prefs[`team${i}` as keyof Preferences]);
    if (leagueId && teamId && !isNaN(leagueId) && !isNaN(teamId)) {
      interestedLeagues[leagueId] = teamId;
    }
  }

  return interestedLeagues;
}

async function getLeagueMatches(leagueId: number, teamId: number, startDate: Date, endDate: Date): Promise<MatchData> {
  try {
    const fotmob = new Fotmob();
    const leagueData = await fotmob.getLeague(leagueId, "overview", "league", "America/New_York");

    if (leagueData?.overview?.leagueOverviewMatches) {
      return leagueData.overview.leagueOverviewMatches
        .filter((match) => isValidMatch(match as MatchItem, teamId, startDate, endDate))
        .map((match) => processMatchData(match as MatchItem, leagueId, leagueData.details?.name ?? ""));
    }
  } catch (error) {
    console.error(`Error fetching league data for ${leagueId}:`, error);
  }
  return [];
}

function isValidMatch(match: MatchItem, teamId: number, startDate: Date, endDate: Date) {
  const matchDate = new Date(match.status?.utcTime || Date.now());
  return (
    matchDate >= startDate &&
    matchDate <= endDate &&
    (Number(match.home?.id) === teamId || Number(match.away?.id) === teamId)
  );
}

function processMatchData(match: MatchItem, leagueId: number, leagueName: string) {
  const isMatchCompleted = match.status?.finished ?? false;
  const winningTeam = isMatchCompleted ? determineWinningTeam(match) : "";

  const date = new Date(match.status?.utcTime ?? new Date());
  const away = {
    id: match.away?.id ?? "",
    name: match.away?.name ?? "",
    score: match.away?.score,
  };
  const home = {
    id: match.home?.id ?? "",
    name: match.home?.name ?? "",
    score: match.home?.score,
  };
  const status = {
    utcTime: match.status?.utcTime ?? new Date(),
    started: match.status?.started ?? false,
    cancelled: match.status?.cancelled ?? false,
    finished: isMatchCompleted,
  };
  const pageUrl = match.pageUrl;
  const matchLink = `https://www.fotmob.com${pageUrl}`;

  return { date, leagueId, leagueName, away, home, status, pageUrl, matchLink, winner: winningTeam };
}

function determineWinningTeam(match: MatchItem) {
  const homeScore = match.home?.score ?? 0;
  const awayScore = match.away?.score ?? 0;

  if (homeScore > awayScore) {
    return match.home?.name ?? "";
  } else if (homeScore < awayScore) {
    return match.away?.name ?? "";
  }

  return "";
}

function formatDateTime(utcDateTime: Date) {
  const dateOptions: Intl.DateTimeFormatOptions = { year: "2-digit", month: "2-digit", day: "2-digit" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

  const formattedDate = utcDateTime.toLocaleDateString("en-US", dateOptions);
  const easternTime = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "America/New_York" }).format(
    utcDateTime,
  );
  const formattedUtcTime = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "UTC" }).format(utcDateTime);

  return `${formattedDate} at ${easternTime} (${formattedUtcTime} UTC)`;
}

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

async function getCachedLeagueMatches(): Promise<MatchData> {
  const cache = new Cache({ namespace: "MatchListCache", capacity: 10 * 1024 * 1024 });
  const preferences = getPreferenceValues<Preferences>();
  const cacheExpiryTimeInMinutes = Number(preferences.cacheExpiryTime) || 60;
  const cacheExpiryTime = cacheExpiryTimeInMinutes * 60 * 1000;

  const cachedData = cache.get("matches");
  const cachedTimestamp = cache.get("matchesTimestamp");

  const currentTime = Date.now();

  if (cachedData && cachedTimestamp && currentTime - parseInt(cachedTimestamp, 10) < cacheExpiryTime) {
    return JSON.parse(cachedData);
  } else {
    const matches = await fetchLeagueMatches();
    cache.set("matches", JSON.stringify(matches));
    cache.set("matchesTimestamp", currentTime.toString());
    return matches;
  }
}

export default function MatchListCommand() {
  const [groupedMatches, setGroupedMatches] = useState<Record<string, MatchItem[]> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAndSetMatches() {
      setIsLoading(true);
      try {
        const cachedMatches = await getCachedLeagueMatches();
        const groupedMatches = groupMatchesByLeague(cachedMatches);
        setGroupedMatches(groupedMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
        setGroupedMatches({});
      }
      setIsLoading(false);
    }
    fetchAndSetMatches();
  }, []);

  if (isLoading) {
    return (
      <List isLoading={true}>
        <List.EmptyView title="Loading matches..." description="Please wait while we fetch the latest matches." />
      </List>
    );
  }

  if (!groupedMatches || Object.keys(groupedMatches).length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No Matches Found"
          description="No matches available for the selected leagues or teams."
        />
      </List>
    );
  }

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
  const { cancelled, finished, started, utcTime } = status;

  if (cancelled) return "cancelled";
  if (finished) return "finished";
  if (started) return "in-progress";
  if (!started && !cancelled && !finished && isToday(new Date(utcTime))) return "today";
  return "upcoming";
}

function MatchItem({ match }: { match: MatchItem }) {
  const status = getMatchStatus(match.status);
  const dateTimeText = formatDateTime(new Date(match.status.utcTime));
  const icon = getMatchIcon(status);
  const title = getMatchTitle(match, status);
  const actions = getMatchActions(match);
  return <List.Item icon={icon} title={title} accessories={[{ text: dateTimeText }]} actions={actions} />;
}

function getMatchIcon(status: string): string {
  switch (status) {
    case "finished":
      return "✅";
    case "in-progress":
      return "⚽️";
    case "cancelled":
      return "❌";
    case "today":
      return "🕒";
    default:
      return "🔜";
  }
}

function getMatchTitle(match: MatchItem, status: string): string {
  if (status === "finished") {
    return getFinishedMatchTitle(match);
  }
  return `${match.home.name} vs ${match.away.name}`;
}

function getFinishedMatchTitle(match: MatchItem): string {
  let title = `${match.home.name} vs ${match.away.name}`;
  if (match.winner) {
    if (match.winner === match.home.name) {
      title = `${match.home.name} 🏆 vs ${match.away.name}`;
    } else {
      title = `${match.home.name} vs ${match.away.name} 🏆`;
    }
    title += ` (${match.home.score} - ${match.away.score})`;
  }
  return title;
}

function getMatchActions(match: MatchItem): JSX.Element {
  return (
    <ActionPanel>
      <Action.OpenInBrowser url={match.matchLink} title="Open Match Details" />
    </ActionPanel>
  );
}
