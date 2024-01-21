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
  const interestedLeagues = {
    [Number(prefs.league1)]: Number(prefs.team1),
    [Number(prefs.league2)]: Number(prefs.team2),
    [Number(prefs.league3)]: Number(prefs.team3),
    [Number(prefs.league4)]: Number(prefs.team4),
    [Number(prefs.league5)]: Number(prefs.team5),
  };

  Object.keys(interestedLeagues).forEach((key) => {
    const leagueId = Number(key);
    const teamId = interestedLeagues[leagueId];
    if (!leagueId || !teamId || isNaN(leagueId) || isNaN(teamId)) {
      delete interestedLeagues[leagueId];
    }
  });

  return interestedLeagues;
}

async function getLeagueMatches(leagueId: number, teamId: number, startDate: Date, endDate: Date): Promise<MatchData> {
  const fotmob = new Fotmob();
  try {
    const leagueData = await fotmob.getLeague(leagueId, "overview", "league", "America/New_York");
    if (leagueData && leagueData.overview && leagueData.overview.leagueOverviewMatches) {
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
  const matchDate = match.status?.utcTime ? new Date(match.status.utcTime) : new Date();
  return (
    matchDate >= startDate &&
    matchDate <= endDate &&
    (Number(match.home?.id) === teamId || Number(match.away?.id) === teamId)
  );
}

function processMatchData(match: MatchItem, leagueId: number, leagueName: string) {
  const isMatchCompleted = match.status?.finished ?? false;
  let winningTeam = "";
  if (isMatchCompleted) {
    winningTeam = determineWinningTeam(match);
  }

  return {
    date: new Date(match.status?.utcTime ?? new Date()),
    leagueId,
    leagueName,
    away: {
      id: match.away?.id ?? "",
      name: match.away?.name ?? "",
      score: match.away?.score,
    },
    home: {
      id: match.home?.id ?? "",
      name: match.home?.name ?? "",
      score: match.home?.score,
    },
    status: {
      utcTime: match.status?.utcTime ?? new Date(),
      started: match.status?.started ?? false,
      cancelled: match.status?.cancelled ?? false,
      finished: match.status?.finished ?? false,
    },
    pageUrl: match.pageUrl,
    matchLink: `https://www.fotmob.com${match.pageUrl}`,
    winner: winningTeam,
  };
}

function determineWinningTeam(match: MatchItem) {
  if ((match.home?.score ?? 0) > (match.away?.score ?? 0)) {
    return match.home?.name ?? "";
  } else if ((match.home?.score ?? 0) < (match.away?.score ?? 0)) {
    return match.away?.name ?? "";
  }
  return "";
}

function getMatchStatus(status: MatchItem["status"]) {
  const { cancelled, finished, started } = status;

  if (cancelled) return "cancelled";
  if (finished) return "finished";
  if (started) return "in-progress";
  return "upcoming";
}

function formatDateTime(utcDateTime: Date) {
  const dateOptions: Intl.DateTimeFormatOptions = { year: "2-digit", month: "2-digit", day: "2-digit" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

  const formattedDate = utcDateTime.toLocaleDateString("en-US", dateOptions);

  const easternTimeFormatter = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "America/New_York" });
  const easternTime = easternTimeFormatter.format(utcDateTime);

  const utcTimeFormatter = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "UTC" });
  const formattedUtcTime = utcTimeFormatter.format(utcDateTime);

  return `${formattedDate} at ${easternTime} (${formattedUtcTime} UTC)`;
}

function isToday(date: Date) {
  const today = new Date();
  const sameYear = date.getFullYear() === today.getFullYear();
  const sameMonth = date.getMonth() === today.getMonth();
  const sameDay = date.getDate() === today.getDate();
  return sameYear && sameMonth && sameDay;
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
  const [groupedMatches, setMatches] = useState<Record<string, MatchItem[]> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const matches = await getCachedLeagueMatches();
        const grouped = matches.reduce((acc: Record<string, MatchItem[]>, match: MatchItem) => {
          (acc[match.leagueName] = acc[match.leagueName] || []).push(match);
          return acc;
        }, {});
        setMatches(grouped);
      } catch (error) {
        console.error("Error fetching matches:", error);
        setMatches({});
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <List isLoading={true}>
        <List.EmptyView title="Loading matches..." description="Please wait while we fetch the latest matches." />
      </List>
    );
  }

  if (Object.keys(groupedMatches || {}).length === 0) {
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
      {groupedMatches &&
        Object.entries(groupedMatches).map(([leagueName, matches], leagueIndex) => (
          <List.Section key={leagueIndex} title={leagueName}>
            {matches.map((match, matchIndex) => {
              const status = getMatchStatus(match.status);
              const dateTimeText = formatDateTime(new Date(match.status.utcTime));
              let icon = "🔜";
              let title = `${match.home.name} vs ${match.away.name}`;

              if (status === "finished") {
                icon = "✅";
                title = `${match.home.name} vs ${match.away.name}`;
                if (match.winner) {
                  if (match.winner === match.home.name) {
                    title = `${match.home.name} 🏆 vs ${match.away.name}`;
                  } else {
                    title = `${match.home.name} vs ${match.away.name} 🏆`;
                  }
                }
                title += ` (${match.home.score} - ${match.away.score})`;
              } else if (status === "in-progress") {
                icon = "⚽️";
                title = `${match.home.name} vs ${match.away.name}`;
              } else if (status === "cancelled") {
                icon = "❌";
                title = `${match.home.name} vs ${match.away.name}`;
              } else if (status === "upcoming" && isToday(new Date(match.status.utcTime))) {
                icon = "🕒";
                title = `${match.home.name} vs ${match.away.name}`;
              }

              return (
                <List.Item
                  key={matchIndex}
                  icon={icon}
                  title={title}
                  accessories={[{ text: dateTimeText }]}
                  actions={
                    <ActionPanel>
                      <Action.OpenInBrowser url={match.matchLink} title="Open Match Details" />
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        ))}
    </List>
  );
}
