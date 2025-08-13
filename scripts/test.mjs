#!/usr/bin/env zx
/* global argv, fs, $ */

/**
 * This script is to be used using https://github.com/google/zx
 *
 * Use with local zx via `yarn zx`
 */

/// <reference types="zx/globals" />

const { verbose = false, test: only, clean = true } = argv;

$.verbose = false;
process.env.FORCE_COLOR=3

const all = [
  "bin",
  "patch",
  "patch-monorepo",
  "patch-resolution",
  "resolutions",
  "scoped",
  "alias-subdeps",
  "alias-monorepo",
  "portal",
  "link",
  "same-resolution",
];

const tests = all.filter((test) => !only || test === only);

/**
 * 
 * @param {Awaited<ReturnType<$>>} output
 * @param {string} prefix 
 */
const printWithPrefix = (output, prefix) => {
  console.log(output.stdout.split("\n").map((line) => {
    return `${prefix} ${line}`;
  }).join("\n"));
  if (output.stderr) {
    console.log(output.stderr.split("\n").map((line) => {
      return `${prefix} ${line}`;
    }).join("\n"));
  }
}

const results = (
  await Promise.allSettled(
    tests.map(async (test) => {
      const prefix = chalk.yellowBright(`[${test}]: `);

      await $`cd tests/${test} && yarn > /dev/null`;
      console.log(prefix, chalk.blueBright('Generating package.json from lockfile.'))

      const generate = await $`cd tests/${test} && node ${__dirname}/../cli.js`;
      if (verbose) {
        printWithPrefix(generate, prefix);
      }

      console.log(prefix, chalk.blueBright('Updating lock file based on generated package.json.'))

      const yarn = await $`cd tests/${test} && yarn install --immutable`;
      if (verbose) {
        printWithPrefix(yarn, prefix);
      }

      const diff = await $`cd tests/${test} && git diff --exit-code yarn.lock`;
      if (verbose) {
        printWithPrefix(diff, prefix);
      }

      console.log(prefix, chalk.greenBright('No diff detected'))
    })
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

console.log(
  `${success.length}/${all.length} tests passed, ${failures.length}/${
    all.length
  } tests failed, ${all.length - results.length}/${all.length} tests skipped`
);

if (results.length === 0) {
  throw new Error("No tests to run");
}

if (failures.length > 0) {
  console.log(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} tests failed`);
}

process.exit(0);
