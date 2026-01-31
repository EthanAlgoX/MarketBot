// Web module exports

export { webSearch, searchMarketInfo, searchMultiple } from "./webSearch.js";
export type { WebSearchConfig, WebSearchResult, SearchResultItem } from "./webSearch.js";

export { webFetch, webFetchMultiple } from "./webFetch.js";
export type { WebFetchConfig, WebFetchResult } from "./webFetch.js";

export { analyzeWebContent, formatAnalysisReport } from "./webAnalyze.js";
export type { WebAnalysisInput, WebAnalysisOutput } from "./webAnalyze.js";

export {
    launchBrowser,
    closeBrowser,
    searchBing,
    searchDuckDuckGo,
    scrapePageContent,
    browserSearchAndScrape,
} from "./browserScraper.js";
export type { BrowserSearchResult, BrowserConfig, ScrapedPage } from "./browserScraper.js";

