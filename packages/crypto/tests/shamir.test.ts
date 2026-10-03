import { describe, it, expect } from "vitest";
import { splitKey, combineKey } from "../src/index";

describe("Shamir splitKey / combineKey", () => {
  it("3-of-5: any valid 3 shares -> original key", async () => {
    const original = new Uint8Array(32);
    for (let i = 0; i < 32; i++) original[i] = i % 251;

    const { k, n, shares } = await splitKey(original, 3, 5);
    expect(k).toBe(3);
    expect(n).toBe(5);
    expect(shares).toHaveLength(5);

    const combos: number[][] = [
      [0, 1, 2],
      [0, 2, 3],
      [1, 3, 4],
      [0, 1, 4],
      [2, 3, 4],
    ];
    for (const idxs of combos) {
      const combo = idxs.map((i) => shares[i]);
      const recovered = await combineKey(combo, 3);
      expect(recovered).toEqual(original);
    }
  });

  it("3-of-5: 2 shares cannot reconstruct", async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const { shares } = await splitKey(original, 3, 5);

    const twoShares: number[][] = [
      [0, 1],
      [0, 2],
      [3, 4],
      [1, 3],
    ];
    for (const idxs of twoShares) {
      const combo = idxs.map((i) => shares[i]);
      await expect(combineKey(combo, 3)).rejects.toThrow();
    }
  });

  it("rejects invalid parameters", async () => {
    await expect(splitKey(new Uint8Array(16), 1, 5)).rejects.toThrow();
    await expect(splitKey(new Uint8Array(16), 6, 5)).rejects.toThrow();
    await expect(splitKey(new Uint8Array(16), 3, 1)).rejects.toThrow();
    await expect(splitKey(new Uint8Array(16), 3, 3)).rejects.toThrow();
  });

  it("rejects secrets shorter than 16 bytes", async () => {
    await expect(splitKey(new Uint8Array(8), 2, 3)).rejects.toThrow();
  });
});
