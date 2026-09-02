export type OperationConfig = {
  formCode: string;
  permissionCode: string;
  reportPrefix: string;
  displayName: string;
};

const OPERATION_CONFIGS: Record<
  string,
  OperationConfig
> = {
  CLOSING: {
    formCode: "CLOSING",
    permissionCode: "closing.submit",
    reportPrefix: "CLS",
    displayName: "Closing Outlet",
  },

  OPENING: {
    formCode: "OPENING",
    permissionCode: "opening.submit",
    reportPrefix: "OPN",
    displayName: "Opening Outlet",
  },
};

export function normalizeOperationCode(
  value: string
) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getOperationConfig(
  formCode: string
): OperationConfig | null {
  const normalized =
    normalizeOperationCode(formCode);

  return (
    OPERATION_CONFIGS[normalized] ??
    null
  );
}
