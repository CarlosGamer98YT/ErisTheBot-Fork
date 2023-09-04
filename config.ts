export const config: Config = {
  adminUsernames: (Deno.env.get("ADMIN_USERNAMES") ?? "").split(",").filter(Boolean),
  pausedReason: null,
  sdApiUrl: Deno.env.get("SD_API_URL") ?? "http://127.0.0.1:7860/",
  maxUserJobs: 3,
  maxJobs: 20,
};

interface Config {
  adminUsernames: string[];
  pausedReason: string | null;
  sdApiUrl: string;
  maxUserJobs: number;
  maxJobs: number;
}
