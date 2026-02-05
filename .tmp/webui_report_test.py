from playwright.sync_api import sync_playwright
import time

URL = "http://localhost:3002/?token=test-token"
PROMPT = "分析黄金行情，给出完整报告"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        # Ensure input is ready
        input_box = page.get_by_placeholder("Direct MarketBot intelligence...")
        input_box.wait_for(timeout=15000)
        input_box.fill(PROMPT)
        page.get_by_role("button", name="Run").click()

        # Wait for steps to appear
        page.wait_for_selector(".trace-card", timeout=20000)

        # Wait for execution to settle (no spinning icons)
        start = time.time()
        while time.time() - start < 120:
            spinning = page.locator(".trace-dot svg.animate-spin").count()
            if spinning == 0:
                break
            time.sleep(1)

        # Collect step cards
        steps = page.locator(".trace-card")
        step_count = steps.count()

        # Output blocks
        outputs = page.locator("text=Output")
        output_count = outputs.count()
        output_texts = []
        if output_count:
            for i in range(output_count):
                block = outputs.nth(i).locator("xpath=../..//pre").first
                try:
                    output_texts.append(block.inner_text(timeout=2000))
                except Exception:
                    output_texts.append("")

        # Check if report seems complete (heuristic)
        longest_output = max((len(t) for t in output_texts), default=0)
        contains_report_keyword = any(
            any(keyword in t for keyword in ["报告", "总结", "趋势", "支撑", "阻力", "技术"])
            for t in output_texts
        )

        # Test card interaction (click second card if exists)
        interaction_ok = False
        if step_count >= 2:
            first = steps.nth(0)
            second = steps.nth(1)
            second.click()
            time.sleep(0.5)
            class_first = first.get_attribute("class") or ""
            class_second = second.get_attribute("class") or ""
            interaction_ok = ("opacity-100" in class_second) or ("opacity-40" in class_first)

        # End indicator (no spinning + at least one completed icon)
        completed_icons = page.locator(".trace-dot svg[data-lucide='check-circle-2']").count()
        end_signal = (page.locator(".trace-dot svg.animate-spin").count() == 0) and completed_icons > 0

        print("RESULTS")
        print(f"step_count={step_count}")
        print(f"output_blocks={output_count}")
        print(f"longest_output_len={longest_output}")
        print(f"output_has_report_keywords={contains_report_keyword}")
        print(f"card_interaction_ok={interaction_ok}")
        print(f"end_signal_detected={end_signal}")

        # Screenshot for reference
        page.screenshot(path="/tmp/webui_report_test.png", full_page=True)

        browser.close()


if __name__ == "__main__":
    main()
