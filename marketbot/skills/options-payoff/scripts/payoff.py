#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass


@dataclass
class OptionLeg:
    side: str
    option_type: str
    strike: float
    premium: float
    quantity: int = 1

    def payoff(self, spot: float, multiplier: int) -> float:
        intrinsic = 0.0
        if self.option_type == "call":
            intrinsic = max(spot - self.strike, 0.0)
        else:
            intrinsic = max(self.strike - spot, 0.0)
        signed = intrinsic - self.premium if self.side == "long" else self.premium - intrinsic
        return signed * self.quantity * multiplier


def breakeven_candidates(legs: list[OptionLeg]) -> list[float]:
    strikes = sorted({leg.strike for leg in legs})
    if not strikes:
        return []
    width = max(strikes[-1] - strikes[0], 1.0)
    candidates = {max(0.0, strike - width) for strike in strikes}
    candidates.update(strikes)
    candidates.update({strike + width for strike in strikes})
    return sorted(candidates)


def total_payoff(legs: list[OptionLeg], spot: float, multiplier: int) -> float:
    return round(sum(leg.payoff(spot, multiplier) for leg in legs), 2)


def build_curve(legs: list[OptionLeg], multiplier: int, low: float | None, high: float | None, steps: int) -> list[dict[str, float]]:
    strikes = [leg.strike for leg in legs]
    center_low = min(strikes) if strikes else 0.0
    center_high = max(strikes) if strikes else 100.0
    width = max(center_high - center_low, max(center_high, 1.0) * 0.25, 10.0)
    start = max(0.0, low if low is not None else center_low - width)
    end = high if high is not None else center_high + width
    if end <= start:
        end = start + max(width, 1.0)
    step = (end - start) / max(steps - 1, 1)
    return [{"spot": round(start + step * i, 4), "pnl": total_payoff(legs, start + step * i, multiplier)} for i in range(steps)]


def summarize(legs: list[OptionLeg], multiplier: int, spot: float | None) -> dict[str, object]:
    curve = build_curve(legs, multiplier, None, None, 101)
    pnls = [row["pnl"] for row in curve]
    summary: dict[str, object] = {
        "max_profit": max(pnls),
        "max_loss": min(pnls),
        "breakeven_candidates": breakeven_candidates(legs),
        "curve": curve,
    }
    if spot is not None:
        summary["current_spot"] = spot
        summary["current_pnl"] = total_payoff(legs, spot, multiplier)
    return summary


def parse_leg(raw: str) -> OptionLeg:
    parts = [part.strip().lower() for part in raw.split(":")]
    if len(parts) < 4:
        raise ValueError(f"invalid leg: {raw}")
    quantity = int(parts[4]) if len(parts) >= 5 else 1
    return OptionLeg(
        side=parts[0],
        option_type=parts[1],
        strike=float(parts[2]),
        premium=float(parts[3]),
        quantity=quantity,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Simple options payoff calculator")
    parser.add_argument("--leg", action="append", required=True, help="Format: side:type:strike:premium[:quantity]")
    parser.add_argument("--multiplier", type=int, default=100)
    parser.add_argument("--spot", type=float)
    parser.add_argument("--low", type=float)
    parser.add_argument("--high", type=float)
    parser.add_argument("--steps", type=int, default=101)
    args = parser.parse_args()

    legs = [parse_leg(raw) for raw in args.leg]
    result = summarize(legs, args.multiplier, args.spot)
    if args.low is not None or args.high is not None or args.steps != 101:
        result["curve"] = build_curve(legs, args.multiplier, args.low, args.high, args.steps)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
