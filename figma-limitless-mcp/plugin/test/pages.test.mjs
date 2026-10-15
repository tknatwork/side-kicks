// movePageTo lands a page at the requested position whichever way Figma's
// insertChild counts the index when a child moves later in its own list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { movePageTo } from "../src/main/pages.ts";

/** insertChild that takes the child out first, then inserts at `index`. */
const afterRemoval = (names) => ({
  children: [...names],
  insertChild(index, child) {
    const rest = this.children.filter((c) => c !== child);
    if (index > rest.length) throw new Error("index out of range");
    rest.splice(index, 0, child);
    this.children = rest;
  },
});

/** insertChild that counts `index` in the list as it was, then drops the old slot. */
const beforeRemoval = (names) => ({
  children: [...names],
  insertChild(index, child) {
    if (index > this.children.length) throw new Error("index out of range");
    const old = this.children.indexOf(child);
    const next = [...this.children];
    next.splice(index, 0, child);
    next.splice(old >= index ? old + 1 : old, 1);
    this.children = next;
  },
});

const PAGES = ["A", "B", "C", "D", "E"];

for (const [label, make] of [["after removal", afterRemoval], ["before removal", beforeRemoval]]) {
  test(`every move lands exactly where asked (insertChild counts ${label})`, () => {
    for (let from = 0; from < PAGES.length; from++) {
      for (let to = 0; to < PAGES.length; to++) {
        const root = make(PAGES);
        const page = PAGES[from];
        assert.equal(movePageTo(root, page, to), to, `${page} ${from}→${to}`);
        const expected = PAGES.filter((p) => p !== page);
        expected.splice(to, 0, page);
        assert.deepEqual(root.children, expected, `${page} ${from}→${to}: others keep their order`);
      }
    }
  });
}

test("out-of-range targets clamp to the first or last position", () => {
  const root = afterRemoval(PAGES);
  assert.equal(movePageTo(root, "B", 99), 4);
  assert.equal(movePageTo(root, "B", -3), 0);
});
