// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import JustTheFactsGame, { STATS_KEY, INPUT_GUARD_MS } from "../JustTheFactsGame.jsx";
import { TIMEOUT_MS, WRONG_HOLD_MS } from "../../lib/justTheFactsEngine.js";

// The round ignores taps in the first INPUT_GUARD_MS after a fact appears and
// grades by performance.now(), so tests move that clock by hand.
let nowOffset = 0;
const realNow = performance.now.bind(performance);
function skipGuard() {
  nowOffset += INPUT_GUARD_MS + 10;
}

beforeEach(() => {
  localStorage.clear();
  nowOffset = 0;
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + nowOffset);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function readFact() {
  const text = screen.getByText(/×/, { selector: "[aria-live]" }).textContent;
  const [a, b] = text.split("×").map((s) => parseInt(s, 10));
  return { a, b, answer: a * b };
}

function typeDigits(digits) {
  for (const d of String(digits)) {
    fireEvent.click(screen.getByRole("button", { name: d }));
  }
}

describe("Just the Facts smoke", () => {
  it("starts a round and advances on a correct keypad answer", () => {
    render(<JustTheFactsGame />);
    expect(screen.getByText("Just the Facts")).toBeTruthy();
    expect(screen.getByText(/facts fast/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("1 of 20")).toBeTruthy();

    skipGuard();
    const { answer } = readFact();
    typeDigits(answer);
    expect(screen.getByText("2 of 20")).toBeTruthy();
  });

  it("lets a wrong digit be corrected with backspace, and ✓ submits a miss", () => {
    render(<JustTheFactsGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    skipGuard();

    const { answer } = readFact();
    const wrongDigit = String(answer)[0] === "9" ? "8" : "9";
    fireEvent.click(screen.getByRole("button", { name: wrongDigit }));
    // Still on the first fact, no flash, keypad live.
    expect(screen.getByText("1 of 20")).toBeTruthy();
    expect(screen.queryByText(`= ${answer}`, { exact: false })).toBeNull();
    expect(screen.getByRole("button", { name: "1" }).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Backspace" }));
    typeDigits(answer);
    expect(screen.getByText("2 of 20")).toBeTruthy();

    // On the next fact, type a wrong number and submit it with ✓.
    skipGuard();
    const second = readFact();
    fireEvent.click(screen.getByRole("button", { name: String(second.answer)[0] === "9" ? "8" : "9" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText(`= ${second.answer}`, { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1" }).disabled).toBe(true);
  });

  it("flashes the answer on timeout, then advances and persists stats", () => {
    vi.useFakeTimers();
    render(<JustTheFactsGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const { answer } = readFact();
    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS + 10);
    });
    expect(screen.getByText(`= ${answer}`, { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1" }).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(WRONG_HOLD_MS + 10);
    });
    expect(screen.getByText("2 of 20")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1" }).disabled).toBe(false);

    // Abandon back to home; nothing should have been saved for an unfinished round.
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    const stored = JSON.parse(localStorage.getItem(STATS_KEY));
    expect(stored.roundNumber).toBe(0);
    expect(Object.keys(stored.facts)).toHaveLength(0);
  });
});
