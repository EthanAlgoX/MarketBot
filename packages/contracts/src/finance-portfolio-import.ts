import type { FinancePortfolioTradeInput } from "./finance-portfolio.js";
import { FinancePortfolioTradeInputSchema } from "./finance-portfolio.js";

export const FINANCE_TRADE_CSV_HEADER =
  "交易编号,交易日期,标的,市场,币种,方向,数量,价格,费用,税费,备注";

const columns: Record<string, keyof FinancePortfolioTradeInput> = {
  交易编号: "externalId",
  externalId: "externalId",
  交易日期: "tradeDate",
  tradeDate: "tradeDate",
  标的: "symbol",
  symbol: "symbol",
  市场: "market",
  market: "market",
  币种: "currency",
  currency: "currency",
  方向: "side",
  side: "side",
  数量: "quantity",
  quantity: "quantity",
  价格: "price",
  price: "price",
  费用: "fee",
  fee: "fee",
  税费: "tax",
  tax: "tax",
  备注: "note",
  note: "note",
};

/** A bounded template CSV reader; broker-specific formats require their own mapping. */
export function parseFinanceTradeCsv(text: string): FinancePortfolioTradeInput[] {
  if (new TextEncoder().encode(text).byteLength > 512 * 1024)
    throw new Error("文件超过 512 KiB，请拆分导入");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const source = text.replace(/^\uFEFF/, "");
  function finishField() {
    row.push(field);
    field = "";
    closed = false;
  }
  function finishRow() {
    finishField();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    if (rows.length > 1001) throw new Error("一次最多导入 1000 条交易");
  }
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === '"') {
      if (field || closed) throw new Error("CSV 引号格式不正确");
      quoted = true;
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") {
      finishRow();
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      if (closed) throw new Error("CSV 引号后存在额外内容");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  if (field || row.length || closed) finishRow();
  if (rows.length < 2) throw new Error("请提供表头和至少一条交易");
  const header = rows[0]?.map((value) => columns[value.trim()]);
  if (!header || header.some((value) => !value) || new Set(header).size !== header.length)
    throw new Error("表头不匹配，请使用交易模板");
  for (const required of [
    "externalId",
    "tradeDate",
    "symbol",
    "market",
    "currency",
    "side",
    "quantity",
    "price",
  ])
    if (!header.includes(required as keyof FinancePortfolioTradeInput))
      throw new Error("表头缺少必填字段，请使用交易模板");
  return rows.slice(1).map((values, index) => {
    if (values.length !== header.length) throw new Error(`第 ${index + 2} 行列数不匹配`);
    const input: Record<string, string> = {};
    for (let col = 0; col < header.length; col += 1) {
      const name = header[col];
      if (name) input[name] = values[col]?.trim() ?? "";
    }
    input.market =
      ({ A股: "cn", 股票: "cn", 加密: "crypto", 加密货币: "crypto" } as Record<string, string>)[
        input.market ?? ""
      ] ??
      input.market?.toLowerCase() ??
      "";
    input.currency = input.currency?.toUpperCase() ?? "";
    input.side =
      ({ 买入: "buy", 卖出: "sell" } as Record<string, string>)[input.side ?? ""] ??
      input.side?.toLowerCase() ??
      "";
    if (!input.fee) delete input.fee;
    if (!input.tax) delete input.tax;
    const parsed = FinancePortfolioTradeInputSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(`第 ${index + 2} 行字段不合法，请检查日期、方向与小数字符串`);
    return parsed.data;
  });
}
