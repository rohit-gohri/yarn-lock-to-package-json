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

const all = [
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
];

const tests = all.filter((test) => !only || test === only);

const results = (
  await Promise.allSettled(
    tests.map(
      (test) =>
        $`cd tests/${test} && \
    yarn > /dev/null && \
    echo "" && \
    echo "Generating package.json from lockfile" && \
    echo "" && \
    node ${__dirname}/../cli.js && \
    echo "" && \
    echo "Updating lock file based on generated package.json" && \
    echo "" && \
    yarn && \
    git diff --exit-code yarn.lock
`
    )
  )
).map((res, index) => {
  return {
    name: tests[index],
    ...res,
  };
});

if (clean !== "false") {
  await $`git checkout tests`;
}

const failures = results.filter((result) => result.status === "rejected");

const success = results.filter((result) => result.status === "fulfilled");

console.log(`${success.length}/${all.length} tests passed, ${failures.length}/${all.length} tests failed, ${all.length - results.length}/${all.length} tests skipped`);

if (results.length === 0) {
  throw new Error("No tests to run");
}

if (failures.length > 0) {
  console.log(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} tests failed`);
}

process.exit(0);
