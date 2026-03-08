import { Financials } from "./secApi.js";

export type FormulaStatus = "PASS" | "FAIL" | "N/A";

export interface FormulaResult {
  name: string;
  status: FormulaStatus;
  value: number;
  target: string;
  message: string;
}

export class FormulaEngine {
  private financials: Financials;

  constructor(financials: Financials) {
    this.financials = financials;
  }

  private getValue(key: string, defaultValue: number = 0): number {
    if (key in this.financials) {
      return this.financials[key].value;
    }
    return defaultValue;
  }

  cashTest(): FormulaResult {
    const cash = this.getValue("CashAndCashEquivalentsAtCarryingValue");
    const shortTermDebt = this.getValue("ShortTermDebt");
    const longTermDebt = this.getValue("LongTermDebt");
    const totalDebt = shortTermDebt + longTermDebt;

    if (totalDebt === 0) {
      return {
        name: "Cash Test",
        status: "PASS",
        value: cash,
        target: "> Total Debt",
        message: "No debt (N/A - effectively PASS)",
      };
    }

    const ratio = cash / totalDebt;
    const status: FormulaStatus = ratio > 1.0 ? "PASS" : "FAIL";

    return {
      name: "Cash Test",
      status,
      value: ratio,
      target: "> 1.0x",
      message: `Coverage: ${ratio.toFixed(2)}x`,
    };
  }

  debtToEquity(): FormulaResult {
    const liabilities = this.getValue("Liabilities");
    const equity = this.getValue("StockholdersEquity");

    if (equity === 0) {
      return {
        name: "Debt-to-Equity",
        status: "FAIL",
        value: 999,
        target: "< 0.5",
        message: "No equity data",
      };
    }

    const ratio = liabilities / equity;
    const status: FormulaStatus = ratio < 0.5 ? "PASS" : "FAIL";

    return {
      name: "Debt-to-Equity",
      status,
      value: ratio,
      target: "< 0.5",
      message: `Ratio: ${ratio.toFixed(2)}`,
    };
  }

  returnOnEquity(): FormulaResult {
    const netIncome = this.getValue("NetIncomeLoss");
    const equity = this.getValue("StockholdersEquity");

    if (equity === 0 || netIncome === 0) {
      return {
        name: "ROE",
        status: "FAIL",
        value: 0,
        target: "> 15%",
        message: "Insufficient data",
      };
    }

    const roe = (netIncome / equity) * 100;
    const status: FormulaStatus = roe > 15 ? "PASS" : "FAIL";

    return {
      name: "ROE",
      status,
      value: roe,
      target: "> 15%",
      message: `${roe.toFixed(1)}%`,
    };
  }

  currentRatio(): FormulaResult {
    const currentAssets = this.getValue("CurrentAssets");
    const currentLiabilities = this.getValue("CurrentLiabilities");

    if (currentLiabilities === 0) {
      return {
        name: "Current Ratio",
        status: "PASS",
        value: 999,
        target: "> 1.5",
        message: "No current liabilities (N/A - effectively PASS)",
      };
    }

    const ratio = currentAssets / currentLiabilities;
    const status: FormulaStatus = ratio > 1.5 ? "PASS" : "FAIL";

    return {
      name: "Current Ratio",
      status,
      value: ratio,
      target: "> 1.5",
      message: `Ratio: ${ratio.toFixed(2)}`,
    };
  }

  operatingMargin(): FormulaResult {
    const operatingIncome = this.getValue("OperatingIncomeLoss");
    const revenue = this.getValue("Revenues");

    if (revenue === 0) {
      return {
        name: "Operating Margin",
        status: "FAIL",
        value: 0,
        target: "> 12%",
        message: "No revenue data",
      };
    }

    const margin = (operatingIncome / revenue) * 100;
    const status: FormulaStatus = margin > 12 ? "PASS" : "FAIL";

    return {
      name: "Operating Margin",
      status,
      value: margin,
      target: "> 12%",
      message: `${margin.toFixed(1)}%`,
    };
  }

  assetTurnover(): FormulaResult {
    const revenue = this.getValue("Revenues");
    const assets = this.getValue("Assets");

    if (assets === 0) {
      return {
        name: "Asset Turnover",
        status: "FAIL",
        value: 0,
        target: "> 0.5",
        message: "No asset data",
      };
    }

    const turnover = revenue / assets;
    const status: FormulaStatus = turnover > 0.5 ? "PASS" : "FAIL";

    return {
      name: "Asset Turnover",
      status,
      value: turnover,
      target: "> 0.5",
      message: turnover.toFixed(2),
    };
  }

  interestCoverage(): FormulaResult {
    const operatingIncome = this.getValue("OperatingIncomeLoss");
    const interestExpense = this.getValue("InterestExpense");

    if (interestExpense === 0) {
      return {
        name: "Interest Coverage",
        status: "PASS",
        value: 999,
        target: "> 3x",
        message: "No interest expense (N/A - effectively PASS)",
      };
    }

    const coverage = operatingIncome / Math.abs(interestExpense);
    const status: FormulaStatus = coverage > 3 ? "PASS" : "FAIL";

    return {
      name: "Interest Coverage",
      status,
      value: coverage,
      target: "> 3x",
      message: `${coverage.toFixed(1)}x`,
    };
  }

  earningsStability(): FormulaResult {
    const netIncome = this.getValue("NetIncomeLoss");
    const status: FormulaStatus = netIncome > 0 ? "PASS" : "FAIL";

    return {
      name: "Earnings Stability",
      status,
      value: netIncome > 0 ? 1 : 0,
      target: "8+/10 years positive",
      message: "Based on latest year only (full history requires more data)",
    };
  }

  freeCashFlow(): FormulaResult {
    let fcf = this.getValue("FreeCashFlow");

    if (fcf === 0) {
      fcf = this.getValue("CashFlowFromContinuingOperatingActivities");
    }

    const status: FormulaStatus = fcf > 0 ? "PASS" : "FAIL";

    return {
      name: "Free Cash Flow",
      status,
      value: fcf,
      target: "> 0",
      message: `$${(fcf / 1_000_000).toFixed(0)}M`,
    };
  }

  capitalAllocation(): FormulaResult {
    const roeResult = this.returnOnEquity();

    return {
      name: "Capital Allocation",
      status: roeResult.status,
      value: roeResult.value,
      target: "> 15%",
      message: `ROE: ${roeResult.message}`,
    };
  }

  evaluateAll(): FormulaResult[] {
    return [
      this.cashTest(),
      this.debtToEquity(),
      this.returnOnEquity(),
      this.currentRatio(),
      this.operatingMargin(),
      this.assetTurnover(),
      this.interestCoverage(),
      this.earningsStability(),
      this.freeCashFlow(),
      this.capitalAllocation(),
    ];
  }

  getScore(): number {
    const results = this.evaluateAll();
    return results.filter((r) => r.status === "PASS").length;
  }
}

if (import.meta.main) {
  const dummyFinancials: Financials = {
    CashAndCashEquivalentsAtCarryingValue: {
      value: 50000000000,
      end_date: "2024-09-28",
      form: "10-K",
    },
    ShortTermDebt: { value: 15000000000, end_date: "2024-09-28", form: "10-K" },
    LongTermDebt: { value: 100000000000, end_date: "2024-09-28", form: "10-K" },
    Liabilities: { value: 290000000000, end_date: "2024-09-28", form: "10-K" },
    StockholdersEquity: {
      value: 62000000000,
      end_date: "2024-09-28",
      form: "10-K",
    },
    NetIncomeLoss: { value: 97000000000, end_date: "2024-09-28", form: "10-K" },
    Revenues: { value: 383000000000, end_date: "2024-09-28", form: "10-K" },
    OperatingIncomeLoss: {
      value: 114000000000,
      end_date: "2024-09-28",
      form: "10-K",
    },
    CurrentAssets: { value: 135000000000, end_date: "2024-09-28", form: "10-K" },
    CurrentLiabilities: {
      value: 153000000000,
      end_date: "2024-09-28",
      form: "10-K",
    },
    InterestExpense: { value: -2900000000, end_date: "2024-09-28", form: "10-K" },
    CashFlowFromContinuingOperatingActivities: {
      value: 110000000000,
      end_date: "2024-09-28",
      form: "10-K",
    },
  };

  const engine = new FormulaEngine(dummyFinancials);
  const results = engine.evaluateAll();

  console.log("Buffett Formula Results:");
  console.log(`Score: ${engine.getScore()}/10\n`);

  for (const result of results) {
    const symbol = result.status === "PASS" ? "✅" : "❌";
    console.log(
      `${symbol} ${result.name}: ${result.message} (Target: ${result.target})`
    );
  }
}
