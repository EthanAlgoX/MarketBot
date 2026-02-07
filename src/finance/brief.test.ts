import { describe, expect, it } from "vitest";
import { buildFinanceBrief } from "./brief.js";

describe("finance brief", () => {
  it("categorizes headlines into buckets", () => {
    const brief = buildFinanceBrief({
      query: "AAPL",
      timeframe: "6mo",
      items: [
        { title: "Apple earnings beat on revenue guidance", link: "x" },
        { title: "Analyst upgrades Apple, raises price target", link: "y" },
        { title: "Apple faces DOJ antitrust lawsuit", link: "z" },
        { title: "Fed signals rates could stay higher", link: "m" },
        { title: "Apple launches new product lineup", link: "p" },
        { title: "Apple stock moves amid broader market", link: "g" },
      ],
    });

    expect(brief.categories).toBeDefined();
    const cats = brief.categories!;
    expect(cats.earnings?.length).toBe(1);
    expect(cats.analyst?.length).toBe(1);
    expect(cats["legal/regulatory"]?.length).toBe(1);
    expect(cats.macro?.length).toBe(1);
    expect(cats["product/ops"]?.length).toBe(1);
    expect(cats.general?.length).toBe(1);
  });
});
