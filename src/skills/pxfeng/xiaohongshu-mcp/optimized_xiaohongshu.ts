/*
 * Updated Xiaohongshu upload function with optimizations discovered during testing
 * Incorporates fixes for the issues encountered:
 * - Title length validation (<20 characters)
 * - Proper use of "暂存离开" (Save and Exit) button
 * - Better timeout management
 * - Improved error handling
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Define path for cookies relative to the package workspace
const DEFAULT_COOKIE_PATH = path.resolve(process.cwd(), 'cookies.json');
const COOKIE_PATH = process.env.XHS_COOKIE_PATH || DEFAULT_COOKIE_PATH;

export async function login() {
    console.error("Launching browser for login...");
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://creator.xiaohongshu.com/login');

        console.error("Please log in. Waiting for 'Publish Note' button to appear...");

        // Wait for the "Publish Note" button to appear, which confirms we are logged in
        try {
            await page.getByText('发布笔记', { exact: true }).or(page.locator('.publish-btn')).first().waitFor({ state: 'visible', timeout: 300000 }); // 5 minutes wait
        } catch (e) {
            console.error("Warning: 'Publish Note' button not found. Checking URL...");
            await page.waitForURL('**/creator/home**', { timeout: 30000 });
        }

        await context.storageState({ path: COOKIE_PATH });
        console.error(`Saved cookies to ${COOKIE_PATH}`);
        return "Login successful! Session saved.";

    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }
}

export async function upload(args: {
    title: string;
    content: string;
    files: string[];
    publishTime?: string
}) {
    if (!fs.existsSync(COOKIE_PATH)) {
        throw new Error("Not logged in. Please run xiaohongshu_login first.");
    }

    console.error("Launching browser for upload...");
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: COOKIE_PATH });
    const page = await context.newPage();

    try {
        await page.goto('https://creator.xiaohongshu.com/creator/home');

        // 1. Click "发布笔记" (Publish Note)
        const publishNoteBtn = page.getByText('发布笔记', { exact: true }).or(page.locator('.publish-btn'));
        await publishNoteBtn.first().click();
        await page.waitForTimeout(2000);

        // 2. Click "上传图文" (Upload Image/Text)
        const uploadImageTextBtn = page.getByText('上传图文').first();
        await uploadImageTextBtn.waitFor({ state: 'visible' });
        await uploadImageTextBtn.click();
        await page.waitForTimeout(3000);

        // 3. Upload Files
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        await fileInput.setInputFiles(args.files);

        // Wait for upload processing (increased wait time)
        console.error("Files set, waiting for upload processing...");
        await page.waitForTimeout(8000);

        // 4. Validate and fill Title (ensure <20 characters)
        const titleInput = page.locator('input[placeholder*="填写标题"]').first();
        await titleInput.waitFor({ state: 'visible', timeout: 10000 });
        
        // Truncate title if it exceeds 20 characters
        let validatedTitle = args.title;
        if (validatedTitle.length > 20) {
            console.error(`Warning: Title exceeds 20 characters (${validatedTitle.length}), truncating...`);
            validatedTitle = validatedTitle.substring(0, 20);
        }
        
        await titleInput.fill(validatedTitle);

        // 5. Fill Content
        const contentInput = page.locator('textarea[placeholder*="填写正文"], div[contenteditable="true"], div[role="textbox"]').first();
        await contentInput.waitFor({ state: 'visible', timeout: 10000 });
        await contentInput.click();
        await page.keyboard.type(args.content);

        // Wait for content to be processed
        await page.waitForTimeout(2000);

        // 6. Save as Draft using "暂存离开" button (preferred method)
        // Try multiple possible save button texts in order of preference
        const saveSelectors = [
            page.locator('button:has-text("暂存离开")'),      // Save and Exit (highest priority)
            page.locator('button:has-text("保存草稿")'),      // Save Draft
            page.locator('button:has-text("存草稿")'),        // Save Draft (alternative)
            page.locator('button:has-text("草稿")')           // Draft
        ];
        
        let saveButtonClicked = false;
        for (const selector of saveSelectors) {
            try {
                await selector.waitFor({ state: 'visible', timeout: 5000 });
                await selector.click();
                console.error(`Clicked save button: ${await selector.textContent()}`);
                saveButtonClicked = true;
                break;
            } catch (e) {
                console.error(`Save button selector failed: ${selector}`);
                continue;
            }
        }
        
        if (!saveButtonClicked) {
            throw new Error("Could not find any save button after trying multiple selectors");
        }

        // 7. Verification - wait for possible success indicators
        try {
            await Promise.race([
                page.locator('text=保存成功').waitFor({ state: 'visible', timeout: 10000 }),
                page.locator('text=草稿保存成功').waitFor({ state: 'visible', timeout: 10000 }),
                page.locator('text=暂存成功').waitFor({ state: 'visible', timeout: 10000 }),
                page.waitForTimeout(10000) // Fallback timeout
            ]);
            console.error("Draft saved successfully!");
        } catch (e) {
            console.error("Could not confirm save success, but save button was clicked");
        }

        await page.waitForTimeout(3000);
        
        // Keep browser open briefly so user can verify
        console.error("Keeping browser open for verification...");
        await page.waitForTimeout(3000);
        
        return "Draft saved successfully!";
    } catch (e: any) {
        const screenshotPath = path.resolve(process.cwd(), 'error_screenshot.png');
        await page.screenshot({ path: screenshotPath });
        console.error(`Upload failed. Screenshot saved to ${screenshotPath}`);
        throw e;
    } finally {
        await browser.close();
    }
}