#!/usr/bin/env zx
/* global argv, fs, $ */

/**
 * This script is to be used using https://github.com/google/zx
 *
 * Use with local zx via `yarn zx`
 */

/// <reference types="zx/globals" />

const { verbose, test: only, clean = true } = argv;

$.verbose = !!verbose;

const tests = [
  "bin",
  "patch",
  "patch-monorepo",
  "patch-resolution",
  "resolutions",
  "scoped",
  "alias-subdeps",
  "portal",
  "link",
  "same-resolution",
].filter(test => !only || test === only);

const results = await Promise.allSettled(
  tests.map(
    (test) =>
      $`cd tests/${test} && \
    yarn && \
    node ${__dirname}/../cli.js && \
    yarn && \
    git diff --exit-code yarn.lock
`
  )
);

if (clean !== "false") {
  await $`git checkout tests`;
}

const failures = results
  .map((res, index) => {
    return {
      name: tests[index],
      ...res,
    };
  })
  .filter((result) => result.status === "rejected");

if (failures.length > 0) {
  console.log(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} tests failed`);
}

console.log(`All tests passed`);
process.exit(0);
