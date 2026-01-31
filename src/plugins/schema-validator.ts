/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import AjvPkg, { type ErrorObject, type ValidateFunction } from "ajv";

const ajv = new (AjvPkg as unknown as new (opts?: object) => import("ajv").default)({
  allErrors: true,
  strict: false,
  removeAdditional: false,
});

type CachedValidator = {
  validate: ValidateFunction;
  schema: Record<string, unknown>;
};

const schemaCache = new Map<string, CachedValidator>();

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return ["invalid config"];
  }
  return errors.map((error) => {
    const path = error.instancePath?.replace(/^\//, "").replace(/\//g, ".") || "<root>";
    const message = error.message ?? "invalid";
    return `${path}: ${message}`;
  });
}

export function validateJsonSchemaValue(params: {
  schema: Record<string, unknown>;
  cacheKey: string;
  value: unknown;
}): { ok: true } | { ok: false; errors: string[] } {
  let cached = schemaCache.get(params.cacheKey);
  if (!cached || cached.schema !== params.schema) {
    const validate = ajv.compile(params.schema);
    cached = { validate, schema: params.schema };
    schemaCache.set(params.cacheKey, cached);
  }

  const ok = cached.validate(params.value);
  if (ok) {
    return { ok: true };
  }
  return { ok: false, errors: formatAjvErrors(cached.validate.errors) };
}
