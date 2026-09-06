// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import JustTheFactsGame, { STATS_KEY } from "../JustTheFactsGame.jsx";
import { TIMEOUT_MS, WRONG_HOLD_MS } from "../../lib/justTheFactsEngine.js";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function readFact() {
  const text = screen.getByText(/×/, { selector: "[aria-live]" }).textContent;
  const [a, b] = text.split("×").map((s) => parseInt(s, 10));
  return { a, b, answer: a * b };
}

function typeDigits(digits) {
  for (const d of String(digits)) {
    fireEvent.pointerDown(screen.getByRole("button", { name: d }));
  }
}

describe("Just the Facts smoke", () => {
  it("starts a round and advances on a correct keypad answer", () => {
    render(<JustTheFactsGame />);
    expect(screen.getByText("Just the Facts")).toBeTruthy();
    expect(screen.getByText(/facts fast/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("1 of 20")).toBeTruthy();

    const { answer } = readFact();
    typeDigits(answer);
    expect(screen.getByText("2 of 20")).toBeTruthy();
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
