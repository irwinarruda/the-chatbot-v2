import { describe, expect, test } from "vitest";
import { isServerPath } from "~/client/mock/start";
import { routes } from "~/routes";

interface RouteNode {
  file?: string;
  path?: string;
  children?: RouteNode[];
}

function routePaths(
  node: RouteNode,
  base = "",
): { file: string; path: string }[] {
  const path = `${base}${node.path ?? ""}`;
  const own = node.file ? [{ file: node.file, path }] : [];
  return own.concat(
    (node.children ?? []).flatMap((child) => routePaths(child, path)),
  );
}

describe("mock start", () => {
  const all = routePaths(routes as RouteNode);

  test("answers every server route without building the backend", () => {
    const missed = all
      .filter(({ file }) => file.startsWith("server/"))
      .filter(({ path }) => !isServerPath(`${path}/`))
      .map(({ path }) => path);
    expect(missed).toEqual([]);
  });

  test("serves every page route", () => {
    const blocked = all
      .filter(({ file }) => file.startsWith("client/"))
      .filter(({ path }) => isServerPath(`${path}/`))
      .map(({ path }) => path);
    expect(blocked).toEqual([]);
  });
});
