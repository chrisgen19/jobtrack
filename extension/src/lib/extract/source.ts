/** Hostname suffix -> source label (matches the web app's suggestions where they overlap). */
const SOURCES: [string, string][] = [
  ["linkedin.com", "LinkedIn"],
  ["jobstreet.com", "JobStreet"],
  ["jobstreet.com.ph", "JobStreet"],
  ["indeed.com", "Indeed"],
  ["seek.com.au", "Seek"],
  ["seek.co.nz", "Seek"],
  ["remoteok.com", "RemoteOK"],
  ["glassdoor.com", "Glassdoor"],
  ["kalibrr.com", "Kalibrr"],
  ["onlinejobs.ph", "OnlineJobs.ph"],
  ["jobsdb.com", "JobsDB"],
  ["wellfound.com", "Wellfound"],
  ["weworkremotely.com", "We Work Remotely"],
  ["greenhouse.io", "Company website"],
  ["lever.co", "Company website"],
  ["ashbyhq.com", "Company website"],
  ["workable.com", "Company website"],
  ["myworkdayjobs.com", "Company website"],
  ["smartrecruiters.com", "Company website"],
  ["bamboohr.com", "Company website"],
];

/** Job boards whose og:site_name is the board, not the employer. */
const BOARDS = new Set([
  "LinkedIn",
  "JobStreet",
  "Indeed",
  "Seek",
  "RemoteOK",
  "Glassdoor",
  "Kalibrr",
  "OnlineJobs.ph",
  "JobsDB",
  "Wellfound",
  "We Work Remotely",
]);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Source label for a page URL, or "Company website" for unknown hosts. */
export function sourceFromUrl(url: string): string {
  const host = hostOf(url);
  if (!host) return "";
  const match = SOURCES.find(([suffix]) => host === suffix || host.endsWith(`.${suffix}`));
  return match ? match[1] : "Company website";
}

/** Whether the page is a job board (so its site name says nothing about the employer). */
export const isJobBoard = (url: string): boolean => BOARDS.has(sourceFromUrl(url));
