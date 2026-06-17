import type { FieldDef, RawRow } from "@/types/studio";

// ─── Tokenizer seguro (sin eval) ────────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "func"; name: string }
  | { type: "fieldRef"; name: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if ("+-*/".includes(ch)) { tokens.push({ type: "op", value: ch as "+" | "-" | "*" | "/" }); i++; continue; }
    if (/\d/.test(ch) || (ch === "." && /\d/.test(expr[i + 1] ?? ""))) {
      let num = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) { num += expr[i++]; }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }
    // Identificador: puede ser función SUM/COUNT/... o nombre de campo
    if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ_]/.test(ch)) {
      let name = "";
      while (i < expr.length && /[a-zA-ZáéíóúÁÉÍÓÚñÑ_0-9\s]/.test(expr[i])) {
        name += expr[i++];
      }
      name = name.trim();
      const funcs = ["SUM", "COUNT", "AVG", "MIN", "MAX"];
      if (funcs.includes(name.toUpperCase()) && expr[i] === "(") {
        tokens.push({ type: "func", name: name.toUpperCase() });
      } else {
        tokens.push({ type: "fieldRef", name });
      }
      continue;
    }
    i++; // skip unknown char
  }
  return tokens;
}

// ─── Evaluador recursivo descendente ────────────────────────────────────────

interface ParseCtx {
  tokens: Token[];
  pos: number;
  row: RawRow;
  allRows: RawRow[];
  fieldMap: Map<string, string>; // alias → nombre original
}

function parseExpr(ctx: ParseCtx): number {
  return parseAddSub(ctx);
}

function parseAddSub(ctx: ParseCtx): number {
  let left = parseMulDiv(ctx);
  while (ctx.pos < ctx.tokens.length) {
    const tok = ctx.tokens[ctx.pos];
    if (tok.type !== "op") break;
    if (tok.value !== "+" && tok.value !== "-") break;
    const opVal = tok.value;
    ctx.pos++;
    const right = parseMulDiv(ctx);
    left = opVal === "+" ? left + right : left - right;
  }
  return left;
}

function parseMulDiv(ctx: ParseCtx): number {
  let left = parseUnary(ctx);
  while (ctx.pos < ctx.tokens.length) {
    const tok = ctx.tokens[ctx.pos];
    if (tok.type !== "op") break;
    if (tok.value !== "*" && tok.value !== "/") break;
    const opVal = tok.value;
    ctx.pos++;
    const right = parseUnary(ctx);
    left = opVal === "*" ? left * right : right !== 0 ? left / right : 0;
  }
  return left;
}

function parseUnary(ctx: ParseCtx): number {
  if (ctx.pos < ctx.tokens.length) {
    const tok = ctx.tokens[ctx.pos];
    if (tok.type === "op" && tok.value === "-") {
      ctx.pos++;
      return -parsePrimary(ctx);
    }
  }
  return parsePrimary(ctx);
}

function parsePrimary(ctx: ParseCtx): number {
  const tok = ctx.tokens[ctx.pos];
  if (!tok) return 0;

  if (tok.type === "number") {
    ctx.pos++;
    return tok.value;
  }

  if (tok.type === "lparen") {
    ctx.pos++;
    const val = parseExpr(ctx);
    if (ctx.tokens[ctx.pos]?.type === "rparen") ctx.pos++;
    return val;
  }

  if (tok.type === "func") {
    ctx.pos++; // consume func name
    if (ctx.tokens[ctx.pos]?.type === "lparen") ctx.pos++; // consume (
    // read field name
    let fieldName = "";
    const fieldTok = ctx.tokens[ctx.pos];
    if (fieldTok?.type === "fieldRef") { fieldName = fieldTok.name; ctx.pos++; }
    if (ctx.tokens[ctx.pos]?.type === "rparen") ctx.pos++; // consume )

    const originalField = ctx.fieldMap.get(fieldName) ?? fieldName;
    const values = ctx.allRows
      .map((r) => parseFloat((r[originalField] ?? "").replace(/[$%,\s]/g, "")))
      .filter((n) => !isNaN(n));

    if (values.length === 0) return 0;
    switch (tok.name) {
      case "SUM": return values.reduce((a, b) => a + b, 0);
      case "COUNT": return values.length;
      case "AVG": return values.reduce((a, b) => a + b, 0) / values.length;
      case "MIN": return Math.min(...values);
      case "MAX": return Math.max(...values);
      default: return 0;
    }
  }

  if (tok.type === "fieldRef") {
    ctx.pos++;
    const originalField = ctx.fieldMap.get(tok.name) ?? tok.name;
    const raw = ctx.row[originalField] ?? "0";
    return parseFloat(raw.replace(/[$%,\s]/g, "")) || 0;
  }

  return 0;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function evaluateFormula(
  formula: string,
  row: RawRow,
  allRows: RawRow[],
  fields: FieldDef[]
): number | string {
  try {
    const fieldMap = new Map<string, string>();
    for (const f of fields) {
      if (f.alias) fieldMap.set(f.alias, f.nombre);
      fieldMap.set(f.nombre, f.nombre);
    }
    const tokens = tokenize(formula);
    const ctx: ParseCtx = { tokens, pos: 0, row, allRows, fieldMap };
    return parseExpr(ctx);
  } catch {
    return "";
  }
}
