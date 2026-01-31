// Language detection utility

export type Language = "zh" | "en";

/**
 * Detect language from text content.
 * Returns "zh" if Chinese characters are found, otherwise "en".
 */
export function detectLanguage(text: string): Language {
    // Check for Chinese characters (CJK Unified Ideographs)
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    return hasChinese ? "zh" : "en";
}

/**
 * Check if text contains Chinese characters
 */
export function containsChinese(text: string): boolean {
    return /[\u4e00-\u9fa5]/.test(text);
}
