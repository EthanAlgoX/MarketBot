// Report Generator Agent - produces human-readable analysis reports

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { ReportContext } from "../core/types.js";
import type { Language } from "../utils/language.js";

const REPORT_PROMPT_EN = `You are a market analyst report writer.
Based on the complete analysis context, generate a professional, concise market report in English.
Include: Executive Summary, Market Conditions, News Analysis (if available), Risk Assessment, and Recommendations.
Use markdown formatting with clear headings and bullet points.
Do not output JSON, code fences, or metadata—only the report.`;

const REPORT_PROMPT_ZH = `你是一名市场分析报告撰写专家。
根据完整的分析上下文，生成专业、简洁的中文市场分析报告。
包含：执行摘要、市场状况、新闻分析（如有）、风险评估和建议。
使用 markdown 格式，使用清晰的标题和要点列表。
不要输出 JSON、代码块或元数据——只输出报告正文。`;

/**
 * Generate a human-readable market analysis report.
 */
export async function runReportGenerator(
    provider: LLMProvider,
    context: ReportContext,
    systemPrompt?: string,
    language: Language = "zh"
): Promise<string> {
    const reportPrompt = language === "en" ? REPORT_PROMPT_EN : REPORT_PROMPT_ZH;
    const combinedSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${reportPrompt}`
        : reportPrompt;

    const userContent = language === "en"
        ? `Generate report for: ${JSON.stringify(context)}`
        : `请为以下分析数据生成报告: ${JSON.stringify(context)}`;

    const messages: LLMMessage[] = [
        { role: "system", content: combinedSystemPrompt },
        { role: "user", content: userContent },
    ];

    const response = await provider.chat(messages);
    const content = response.content.trim();

    // Check if response looks like a valid report
    if (!isLikelyJson(content) && hasMarkdownHeading(content)) {
        return response.content;
    }

    // Fallback to template-based report
    return generateReportFallback(context, language);
}

function isLikelyJson(content: string): boolean {
    if (!content) return false;
    if (content.startsWith("{") || content.startsWith("[")) return true;
    if (/^```(?:json)?/i.test(content)) return true;
    return false;
}

function hasMarkdownHeading(content: string): boolean {
    return /^#{1,3}\s+\S+/m.test(content);
}

// Localized strings for fallback report
const STRINGS = {
    en: {
        reportTitle: "Market Analysis Report",
        date: "Date",
        market: "Market",
        analysisGoal: "Analysis Goal",
        timeframes: "Timeframes",
        executiveSummary: "Executive Summary",
        marketConditions: "Market Conditions",
        structure: "Structure",
        volatility: "Volatility",
        momentum: "Momentum",
        nearestSupport: "Nearest Support",
        nearestResistance: "Nearest Resistance",
        regimeAnalysis: "Regime Analysis",
        currentRegime: "Current Regime",
        regimeConfidence: "Regime Confidence",
        recommendedStrategy: "Recommended Strategy",
        rationale: "Rationale",
        riskAssessment: "Risk Assessment",
        riskLevel: "Risk Level",
        positionSizing: "Position Sizing",
        stopLoss: "Stop Loss",
        warning: "Warning",
        recommendations: "Recommendations",
        recommendationStrength: "Recommendation Strength",
        overallConfidence: "Overall Confidence",
        actionItems: "Action Items",
        potentialBlindspots: "Potential Blindspots",
        alternativeScenarios: "Alternative Scenarios",
        disclaimer: "This analysis is for informational purposes only and does not constitute financial advice.",
        // Strategy actions
        trendFollowing: [
            "Consider position in the direction of the trend",
            "Use trailing stops to protect gains",
            "Monitor for trend exhaustion signals",
        ],
        meanReversion: [
            "Watch for entries at key support/resistance levels",
            "Use tight stops with defined risk",
            "Take profits at range boundaries",
        ],
        wait: [
            "Avoid new entries until conditions improve",
            "Monitor for breakout confirmation",
            "Preserve capital for better opportunities",
        ],
        hedge: [
            "Consider reducing exposure",
            "Implement protective strategies",
            "Watch for distribution confirmation",
        ],
    },
    zh: {
        reportTitle: "市场分析报告",
        date: "日期",
        market: "市场",
        analysisGoal: "分析目标",
        timeframes: "时间周期",
        executiveSummary: "执行摘要",
        marketConditions: "市场状况",
        structure: "结构",
        volatility: "波动性",
        momentum: "动量",
        nearestSupport: "最近支撑位",
        nearestResistance: "最近阻力位",
        regimeAnalysis: "市场体制分析",
        currentRegime: "当前体制",
        regimeConfidence: "体制置信度",
        recommendedStrategy: "推荐策略",
        rationale: "依据",
        riskAssessment: "风险评估",
        riskLevel: "风险等级",
        positionSizing: "仓位建议",
        stopLoss: "止损",
        warning: "警告",
        recommendations: "建议",
        recommendationStrength: "建议强度",
        overallConfidence: "整体置信度",
        actionItems: "行动计划",
        potentialBlindspots: "潜在盲点",
        alternativeScenarios: "备选情景",
        disclaimer: "本分析仅供参考，不构成任何投资建议。",
        // Strategy actions
        trendFollowing: [
            "考虑顺势建仓",
            "使用移动止损保护收益",
            "监控趋势衰竭信号",
        ],
        meanReversion: [
            "关注关键支撑/阻力位入场机会",
            "使用严格止损控制风险",
            "在区间边界获利了结",
        ],
        wait: [
            "等待市场条件改善后再入场",
            "观察突破确认信号",
            "保留资金等待更好机会",
        ],
        hedge: [
            "考虑降低风险敞口",
            "实施保护性策略",
            "观察派发确认信号",
        ],
    },
};

// Value translations
const VALUE_TRANSLATIONS: Record<string, Record<string, { en: string; zh: string }>> = {
    market: {
        crypto: { en: "Crypto", zh: "加密货币" },
        stocks: { en: "Stocks", zh: "股票" },
        forex: { en: "Forex", zh: "外汇" },
        commodities: { en: "Commodities", zh: "大宗商品" },
        futures: { en: "Futures", zh: "期货" },
    },
    market_structure: {
        trending_up: { en: "Trending Up", zh: "上升趋势" },
        trending_down: { en: "Trending Down", zh: "下降趋势" },
        ranging: { en: "Ranging", zh: "区间震荡" },
        volatile: { en: "Volatile", zh: "高波动" },
    },
    volatility_state: {
        high: { en: "High", zh: "高" },
        medium: { en: "Medium", zh: "中" },
        low: { en: "Low", zh: "低" },
    },
    momentum: {
        strong_bullish: { en: "Strong Bullish", zh: "强多" },
        bullish: { en: "Bullish", zh: "偏多" },
        neutral: { en: "Neutral", zh: "中性" },
        bearish: { en: "Bearish", zh: "偏空" },
        strong_bearish: { en: "Strong Bearish", zh: "强空" },
    },
    regime: {
        bull_trend: { en: "Bull Trend", zh: "牛市趋势" },
        bear_trend: { en: "Bear Trend", zh: "熊市趋势" },
        accumulation: { en: "Accumulation", zh: "吸筹" },
        distribution: { en: "Distribution", zh: "派发" },
        choppy: { en: "Choppy", zh: "震荡" },
    },
    recommended_strategy: {
        trend_following: { en: "Trend Following", zh: "趋势跟随" },
        mean_reversion: { en: "Mean Reversion", zh: "均值回归" },
        wait: { en: "Wait", zh: "观望" },
        hedge: { en: "Hedge", zh: "对冲" },
    },
    risk_level: {
        low: { en: "LOW", zh: "低" },
        medium: { en: "MEDIUM", zh: "中" },
        high: { en: "HIGH", zh: "高" },
        extreme: { en: "EXTREME", zh: "极高" },
    },
    position_size_recommendation: {
        full: { en: "Full", zh: "满仓" },
        half: { en: "Half", zh: "半仓" },
        quarter: { en: "Quarter", zh: "四分之一仓" },
        none: { en: "None", zh: "空仓" },
    },
    stop_loss_suggestion: {
        tight: { en: "Tight", zh: "紧" },
        normal: { en: "Normal", zh: "常规" },
        wide: { en: "Wide", zh: "宽" },
    },
    recommendation_strength: {
        strong: { en: "STRONG", zh: "强" },
        moderate: { en: "MODERATE", zh: "中" },
        weak: { en: "WEAK", zh: "弱" },
    },
    analysis_goal: {
        entry_signal: { en: "Entry Signal", zh: "入场信号" },
        exit_signal: { en: "Exit Signal", zh: "出场信号" },
        risk_check: { en: "Risk Check", zh: "风险检查" },
        general_analysis: { en: "General Analysis", zh: "综合分析" },
    },
};

function translateValue(category: string, value: string, lang: Language): string {
    const translation = VALUE_TRANSLATIONS[category]?.[value];
    if (translation) return translation[lang];
    // Fallback: replace underscores with spaces and capitalize
    return value.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function generateReportFallback(context: ReportContext, language: Language): string {
    const { intent, market, regime, risk, reflection } = context;
    const t = STRINGS[language];

    const timestamp = new Date().toISOString().split("T")[0];
    const confidencePercent = Math.round(reflection.confidence_score * 100);

    const sections: string[] = [];

    // Header
    sections.push(`# ${intent.asset} ${t.reportTitle}`);
    sections.push(`**${t.date}:** ${timestamp}  `);
    sections.push(`**${t.market}:** ${translateValue("market", intent.market, language)}  `);
    sections.push(`**${t.analysisGoal}:** ${translateValue("analysis_goal", intent.analysis_goal, language)}  `);
    sections.push(`**${t.timeframes}:** ${intent.timeframes.join(", ")}`);
    sections.push("");

    // Executive Summary
    sections.push(`## ${t.executiveSummary}`);
    sections.push(reflection.final_summary);
    sections.push("");

    // Market Conditions
    sections.push(`## ${t.marketConditions}`);
    sections.push(`- **${t.structure}:** ${translateValue("market_structure", market.market_structure, language)}`);
    sections.push(`- **${t.volatility}:** ${translateValue("volatility_state", market.volatility_state, language)}`);
    sections.push(`- **${t.momentum}:** ${translateValue("momentum", market.momentum, language)}`);
    if (market.key_levels.nearest_support) {
        sections.push(`- **${t.nearestSupport}:** ${market.key_levels.nearest_support}`);
    }
    if (market.key_levels.nearest_resistance) {
        sections.push(`- **${t.nearestResistance}:** ${market.key_levels.nearest_resistance}`);
    }
    sections.push("");

    // Regime Analysis
    sections.push(`## ${t.regimeAnalysis}`);
    sections.push(`- **${t.currentRegime}:** ${translateValue("regime", regime.regime, language)}`);
    sections.push(`- **${t.regimeConfidence}:** ${Math.round(regime.confidence * 100)}%`);
    sections.push(`- **${t.recommendedStrategy}:** ${translateValue("recommended_strategy", regime.recommended_strategy, language)}`);
    sections.push(`- **${t.rationale}:** ${regime.rationale}`);
    sections.push("");

    // Risk Assessment
    sections.push(`## ${t.riskAssessment}`);
    sections.push(`- **${t.riskLevel}:** ${translateValue("risk_level", risk.risk_level, language)}`);
    sections.push(`- **${t.positionSizing}:** ${translateValue("position_size_recommendation", risk.position_size_recommendation, language)}`);
    sections.push(`- **${t.stopLoss}:** ${translateValue("stop_loss_suggestion", risk.stop_loss_suggestion, language)}`);
    if (risk.max_drawdown_warning) {
        sections.push(`- **⚠️ ${t.warning}:** ${risk.max_drawdown_warning}`);
    }
    sections.push("");

    // Recommendations
    sections.push(`## ${t.recommendations}`);
    const actionIcon = reflection.recommendation_strength === "strong" ? "✅" :
        reflection.recommendation_strength === "weak" ? "⚠️" : "💡";
    sections.push(`${actionIcon} **${t.recommendationStrength}:** ${translateValue("recommendation_strength", reflection.recommendation_strength, language)}`);
    sections.push(`📊 **${t.overallConfidence}:** ${confidencePercent}%`);
    sections.push("");

    // Action items based on regime
    const strategyKey = regime.recommended_strategy as keyof typeof t;
    const actionItems = t[strategyKey] as string[] | undefined;
    if (actionItems && Array.isArray(actionItems)) {
        sections.push(`### ${t.actionItems}`);
        actionItems.forEach((item) => {
            sections.push(`- ${item}`);
        });
        sections.push("");
    }

    // Potential Blindspots
    if (reflection.potential_blindspots.length > 0) {
        sections.push(`## ${t.potentialBlindspots}`);
        reflection.potential_blindspots.forEach((blindspot) => {
            sections.push(`- ${blindspot}`);
        });
        sections.push("");
    }

    // Alternative Scenarios
    if (reflection.alternative_scenarios.length > 0) {
        sections.push(`## ${t.alternativeScenarios}`);
        reflection.alternative_scenarios.forEach((scenario) => {
            sections.push(`- ${scenario}`);
        });
        sections.push("");
    }

    // Disclaimer
    sections.push("---");
    sections.push(`*${t.disclaimer}*`);

    return sections.join("\n");
}
