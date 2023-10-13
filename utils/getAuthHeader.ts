export function getAuthHeader(auth: { user: string; password: string } | null) {
  if (!auth) return {};
  return { "Authorization": `Basic ${btoa(`${auth.user}:${auth.password}`)}` };
}
