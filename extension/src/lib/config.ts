/** Origin of the JobTrack server this build talks to (see .env.example). */
export const JOBTRACK_ORIGIN = new URL(import.meta.env.WXT_JOBTRACK_URL).origin;

export const jobtrackUrl = (path: string): string => new URL(path, JOBTRACK_ORIGIN).toString();
