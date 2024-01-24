import { getPreferenceValues } from "@raycast/api";
import fetch from "node-fetch";
import { LeagueData, MatchData, MatchItem } from "./types/matchTypes";
import { Preferences } from "./types/preferencesTypes";

export async function fetchLeagueMatches(): Promise<MatchData> {
  const prefs = getPreferenceValues<Preferences>();
  const startDateOffset = Number(prefs.startDateOffset) || 7;
  const endDateOffset = Number(prefs.endDateOffset) || 30;
  const currentDate = new Date();
  const startDate = new Date(currentDate.setDate(currentDate.getDate() - startDateOffset));
  const endDate = new Date(currentDate.setDate(currentDate.getDate() + endDateOffset));

  const interestedLeagues = getInterestedTeams(prefs);
  const allMatches: MatchData = [];

  for (const [leagueId, teamId] of Object.entries(interestedLeagues)) {
    console.log(`Fetching matches for league ${leagueId} and team ${teamId}`);
    const matches = await getLeagueMatches(Number(leagueId), teamId, startDate, endDate);
    allMatches.push(...matches);
  }

  return allMatches;
}

function getInterestedTeams(prefs: Preferences): number[] {
  const interestedTeams: number[] = [];

  for (let i = 1; i <= 5; i++) {
    const teamId = Number(prefs[`team${i}` as keyof Preferences]);
    if (teamId && !isNaN(teamId)) {
      interestedTeams.push(teamId);
    }
  }

  return interestedTeams;
}

async function getLeagueMatches(leagueId: number, teamId: number, startDate: Date, endDate: Date): Promise<MatchData> {
  const url = `https://www.fotmob.com/api/leagues?id=${leagueId}&tab=overview&type=league&timeZone="America/New_York"`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching league data: ${response.statusText}`);
    }
    const leagueData = (await response.json()) as LeagueData;

    if (leagueData?.overview?.leagueOverviewMatches) {
      return leagueData.overview.leagueOverviewMatches
        .filter((match: MatchItem) => isValidMatch(match as MatchItem, teamId, startDate, endDate))
        .map((match: MatchItem) => processMatchData(match as MatchItem, leagueId, leagueData.details?.name ?? ""));
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
  const id = match.id;
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
    ongoing: match.status?.ongoing ?? false,
  };
  const result = match.result;
  const pageUrl = match.pageUrl;
  const matchLink = `https://www.fotmob.com${pageUrl}`;

  return { date, id, leagueId, leagueName, away, home, status, result, pageUrl, matchLink, winner: winningTeam };
}

function determineWinningTeam(match: MatchItem) {
  const homeScore = match.home?.score ?? 0;
  const awayScore = match.away?.score ?? 0;

  if (homeScore > awayScore) {
    return match.home?.name ?? "";
  } else if (homeScore < awayScore) {
    return match.away?.name ?? "";
  } else if (homeScore === awayScore) {
    return "draw";
  }

  return "";
}
