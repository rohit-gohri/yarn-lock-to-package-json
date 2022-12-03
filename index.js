#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseSyml } = require("@yarnpkg/parsers");

function main() {
  const lockFile = fs.readFileSync("yarn.lock", "utf8");
  const lockJson = parseSyml(lockFile);

  const workspacePackages = Object.keys(lockJson).filter((dependency) => {
    return dependency.includes("@workspace:");
  });

  const packagesConfig = workspacePackages
    .map((packageVersion) => {
      const [, dirPath] = lockJson[packageVersion].resolution
        .trim()
        .split("@workspace:");

      if (dirPath === ".") {
        return null;
      }
      return dirPath;
    })
    .filter(Boolean);

  workspacePackages.forEach((packageVersion) => {
    const {
      dependencies,
      dependenciesMeta,
      peerDependencies,
      peerDependenciesMeta,
      resolution,
    } = lockJson[packageVersion];
    const [name, dirPath] = resolution.trim().split("@workspace:");
    const packageJsonPath = path.join(dirPath, `package.json`);

    const packageJson = {
      name,
      version: "0.0.0",
      description: "**DON'T COMMIT** Generated file for caching",
      private: true,
      dependencies,
      peerDependencies,
      peerDependenciesMeta,
    };

    if (dependenciesMeta) {
      /**
       * @type {Record<string, any>}
       */
      let optionalDependencies = {};
      Object.keys(dependenciesMeta).forEach((key) => {
        optionalDependencies[key] = dependencies[key];
        delete dependencies[key];
      });
      packageJson.optionalDependencies = optionalDependencies;
    }

    if (dirPath === ".") {
      packageJson.workspaces = {
        packages: packagesConfig,
      };
    }

    fs.mkdirSync(dirPath, {
      recursive: true,
    });
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\r`
    );
  });
}

if (require.main === module) {
  main();
}
