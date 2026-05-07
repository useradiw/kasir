export interface ValidateResult {
  valid: boolean;
  tables: string[];
  counts: Record<string, number>;
  errors: string[];
}

export function validateBackup(data: unknown): ValidateResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, tables: [], counts: {}, errors: ["File bukan objek JSON yang valid"] };
  }

  const obj = data as Record<string, unknown>;
  if (!obj.tables || typeof obj.tables !== "object" || Array.isArray(obj.tables)) {
    return { valid: false, tables: [], counts: {}, errors: ['Field "tables" tidak ditemukan atau tidak valid'] };
  }

  const tables = obj.tables as Record<string, unknown>;
  const validTables: string[] = [];
  const counts: Record<string, number> = {};

  for (const [key, value] of Object.entries(tables)) {
    if (!Array.isArray(value)) {
      errors.push(`Tabel "${key}" bukan array`);
      continue;
    }
    validTables.push(key);
    counts[key] = value.length;
  }

  return { valid: errors.length === 0, tables: validTables, counts, errors };
}
