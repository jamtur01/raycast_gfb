import fetch from "node-fetch";
import { TeamDetailData } from "./types/matchTypes";

export async function fetchTeamDetail(teamId: number) {
  let data, error, isLoading;
  try {
    const url = `https://www.fotmob.com/api/teams?id=${teamId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch team details");
    }
    data = (await response.json()) as TeamDetailData;
    isLoading = false;
  } catch (e) {
    error = e;
  }

  return { data, error, isLoading };
}
