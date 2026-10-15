/** The part of figma.root a page move needs, so the move can be tested
 *  without Figma. */
export interface PageList<P> {
  readonly children: readonly P[];
  insertChild(index: number, child: P): void;
}

/**
 * Moves `page` so it ends at `target` (clamped to the page list) and returns
 * where it landed. The typings don't say whether insertChild's index counts a
 * child's own old slot when it moves later in the same list, which would leave
 * it one short; checking where it landed and inserting once more covers both.
 */
export const movePageTo = <P>(root: PageList<P>, page: P, target: number): number => {
  const to = Math.max(0, Math.min(Math.floor(target), root.children.length - 1));
  const from = root.children.indexOf(page);
  if (from !== to) {
    root.insertChild(to, page);
    if (from < to && root.children.indexOf(page) === to - 1) {
      root.insertChild(to + 1, page);
    }
  }
  return root.children.indexOf(page);
};
