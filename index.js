#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseSyml } = require("@yarnpkg/parsers");

function main() {
  const lockFile = fs.readFileSync("yarn.lock", "utf8");
  const lockJson = parseSyml(lockFile);

  Object.keys(lockJson)
    .filter((dependency) => {
      return dependency.includes("@workspace:");
    })
    .forEach((packageVersion) => {
      const {
        dependencies,
        dependenciesMeta,
        peerDependencies,
        peerDependenciesMeta,
        resolution,
      } = lockJson[packageVersion];
      const [name, dirPath] = resolution.trim().split("@workspace:");
      const packageJsonPath = path.join(dirPath, `package.json`);

      const { workspaces, packageManager } = JSON.parse(
        fs.readFileSync(packageJsonPath).toString()
      );

      /**
       * @type {Record<string, any>}
       */
      const optionalDependencies = {};

      if (dependenciesMeta) {
        Object.keys(dependenciesMeta).forEach((key) => {
          optionalDependencies[key] = dependencies[key];
          delete dependencies[key];
        });
      }

      const packageJson = {
        name,
        version: "0.0.0",
        workspaces,
        description: "**DON'T COMMIT** Generated file for caching",
        private: true,
        dependencies,
        optionalDependencies,
        peerDependencies,
        peerDependenciesMeta,
        packageManager,
      };

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
