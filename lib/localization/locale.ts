export const SUPPORTED_LOCALES = [
  "en",
  "id-ID",
] as const;

export type AppLocale =
  (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(
  value: unknown
): value is AppLocale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.includes(
      value as AppLocale
    )
  );
}

export function resolveOperationLocale({
  reportLocaleSnapshot,
  outletDefaultLocale,
  hasExistingReport,
}: {
  reportLocaleSnapshot: unknown;
  outletDefaultLocale: unknown;
  hasExistingReport: boolean;
}): AppLocale {
  if (hasExistingReport) {
    return isSupportedLocale(
      reportLocaleSnapshot
    )
      ? reportLocaleSnapshot
      : "en";
  }

  return isSupportedLocale(
    outletDefaultLocale
  )
    ? outletDefaultLocale
    : "en";
}
