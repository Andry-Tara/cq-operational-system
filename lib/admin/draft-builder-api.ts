import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function requireBuilderPermission() {
  const access = await checkPermissionApi("forms.manage");

  if (!access.ok) {
    return {
      response: errorResponse(access.status, access.error),
    } as const;
  }

  return { response: null } as const;
}

export async function parseStrictObject<T extends Record<string, unknown>>(
  request: Request,
  keys: readonly string[],
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      value: null,
      response: errorResponse(400, "Invalid request body."),
    } as const;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      value: null,
      response: errorResponse(400, "Invalid request body."),
    } as const;
  }

  const record = body as Record<string, unknown>;
  const bodyKeys = Object.keys(record);

  if (
    bodyKeys.length !== keys.length ||
    bodyKeys.some((key) => !keys.includes(key))
  ) {
    return {
      value: null,
      response: errorResponse(400, "Request contains unsupported fields."),
    } as const;
  }

  return { value: record as T, response: null } as const;
}

export function requireString(
  value: unknown,
  nullable = false,
): value is string | null {
  return (
    (nullable && value === null) ||
    (typeof value === "string" && value.trim().length > 0)
  );
}

export function requireNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function requireBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function requireNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function requireNullableNumber(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

export function mapRpcError(error: { code?: string } | null) {
  switch (error?.code) {
    case "22P02":
      return errorResponse(400, "Invalid identifier or input.");
    case "22023":
      return errorResponse(400, "Invalid builder input or target.");
    case "42501":
      return errorResponse(403, "Permission denied.");
    case "55000":
      return errorResponse(409, "This draft is no longer editable.");
    case "23514":
      return errorResponse(400, "The builder input failed validation.");
    default:
      return errorResponse(500, "Unable to save the draft.");
  }
}

export async function invokeBuilderRpc(
  functionName: string,
  args: Record<string, unknown>,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(functionName, args);

  if (error) {
    return mapRpcError(error);
  }

  return null;
}
