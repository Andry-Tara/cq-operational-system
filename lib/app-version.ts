// ============================================================
// RESTO OPERATIONAL SYSTEM - BUILD VERSION
// ============================================================
//
// APP_VERSION:
// Naikkan manual hanya untuk release feature / milestone.
//
// BUILD SHA:
// Otomatis mengikuti Git commit dari Vercel setiap deploy.
// ============================================================

export const APP_VERSION = "1.0.0";

export function getAppBuildInfo() {
  const rawSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    "";

  const buildSha =
    rawSha.trim()
      ? rawSha.trim().slice(0, 7)
      : "local";

  const vercelEnvironment =
    process.env.VERCEL_ENV;

  const environment =
    vercelEnvironment === "production"
      ? "Production"
      : vercelEnvironment === "preview"
        ? "Preview"
        : "Local";

  return {
    appVersion: `v${APP_VERSION}`,
    buildSha,
    environment,
  };
}
