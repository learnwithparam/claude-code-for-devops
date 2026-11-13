// Every page a learner can open. The board is written by `bun world/board.ts --html`.
export type Route = { name: string; path: string };

export const routes: Route[] = [{ name: "board", path: "/board.html" }];

// Button verbs this course uses beyond the shared list, in lower case.
export const extraButtonVerbs: string[] = [];
