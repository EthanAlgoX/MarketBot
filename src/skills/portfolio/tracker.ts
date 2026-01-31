
import { ToolResult, ToolSpec } from "../../tools/types.js";
import fs from "fs/promises";
import path from "path";

const PORTFOLIO_FILE = path.join(process.cwd(), "data", "portfolio.json");

interface PortfolioAddArgs {
    asset: string;
    amount: number;
    price: number;
}

interface PortfolioRemoveArgs {
    asset: string;
    amount: number;
}

export function portfolioTools(): ToolSpec[] {
    return [portfolioAddTool(), portfolioRemoveTool(), portfolioStatusTool()];
}

async function loadPortfolio(): Promise<Record<string, { amount: number, avgPrice: number }>> {
    try {
        const data = await fs.readFile(PORTFOLIO_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function savePortfolio(data: any): Promise<void> {
    await fs.mkdir(path.dirname(PORTFOLIO_FILE), { recursive: true });
    await fs.writeFile(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function portfolioAddTool(): ToolSpec {
    return {
        name: "portfolio_add",
        description: "Add an asset to the portfolio",
        version: "1.0.0",
        tags: ["portfolio"],
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string" },
                amount: { type: "number" },
                price: { type: "number" },
            },
            required: ["asset", "amount", "price"],
        },
        run: async (context: any): Promise<ToolResult> => {
            const args = (context.json || {}) as PortfolioAddArgs;
            const portfolio = await loadPortfolio();

            const current = portfolio[args.asset] || { amount: 0, avgPrice: 0 };
            const newAmount = current.amount + args.amount;
            const newCost = (current.amount * current.avgPrice) + (args.amount * args.price);
            portfolio[args.asset] = {
                amount: newAmount,
                avgPrice: newCost / newAmount
            };

            await savePortfolio(portfolio);

            return {
                ok: true,
                output: `Added ${args.amount} ${args.asset} at $${args.price}. New total: ${newAmount}`
            };
        }
    };
}

function portfolioRemoveTool(): ToolSpec {
    return {
        name: "portfolio_remove",
        description: "Remove an asset from the portfolio",
        version: "1.0.0",
        tags: ["portfolio"],
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string" },
                amount: { type: "number" },
            },
            required: ["asset", "amount"],
        },
        run: async (context: any): Promise<ToolResult> => {
            const args = (context.json || {}) as PortfolioRemoveArgs;
            const portfolio = await loadPortfolio();

            if (!portfolio[args.asset] || portfolio[args.asset].amount < args.amount) {
                return { ok: false, output: "Insufficient balance" };
            }

            portfolio[args.asset].amount -= args.amount;
            if (portfolio[args.asset].amount <= 0) {
                delete portfolio[args.asset];
            }

            await savePortfolio(portfolio);
            return { ok: true, output: `Removed ${args.amount} ${args.asset}.` };
        }
    };
}

function portfolioStatusTool(): ToolSpec {
    return {
        name: "portfolio_status",
        description: "Get current portfolio status",
        version: "1.0.0",
        tags: ["portfolio"],
        run: async (context: any): Promise<ToolResult> => {
            const portfolio = await loadPortfolio();
            // In a real app, we would fetch current prices here to calc PnL
            // For now, just return the holdings
            return {
                ok: true,
                output: JSON.stringify(portfolio, null, 2)
            };
        }
    };
}
