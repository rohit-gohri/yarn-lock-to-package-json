const fs = require("fs");
const path = require("path");
const { parseSyml } = require("@yarnpkg/parsers");

const supportedProtocols = ["patch", "npm", "portal", "link"];

/**
 * @param {string} dep 
 */
const getDepName = (dep) => {
  let parts = dep.trim().split("@");
  if (dep.startsWith("@")) {
    parts = parts.slice(0, 2);
  } else {
    parts = parts.slice(0, 1);
  }
  return parts.join("@");
};

/**
 * @param {string} dependency
 * @param {string} protocol
 */
const getKeyVersion = (dependency, protocol) => {
  const [key, version] = dependency.trim().split(`@${protocol}:`);

  return {
    key,
    version,
  };
};

/**
 * @param {string} version
 */
const getPatchPath = (version) => {
  const [, patchPath] = version.split("::")[0].split("#");
  return patchPath;
};

module.exports = function main() {
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
      bin,
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
      bin,
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
      if (packagesConfig.length > 0) {
        packageJson.workspaces = {
          packages: packagesConfig,
        };
      }

      const lockJsonKey = Object.keys(lockJson);
      /**
       * @type {Map<string, string[]>}
       */
      const dependencyMap = new Map();
      lockJsonKey.forEach((dep) => {
        dep.split(",").forEach((dependency) => {
          const name = getDepName(dependency);
          if (!dependencyMap.has(name)) {
            dependencyMap.set(name, []);
          }
          dependencyMap.get(name).push(dependency);
        });
      });

      /**
       * This will add all the dependencies that are not present multiple times in the lock file
       * as resolutions since we can't differentiate them but adding them unnecessarily has no side effect
       */
      packageJson.resolutions = lockJsonKey
        .filter((dependency) => {
          if (dependency.includes("@workspace:")) {
            return false;
          }

          // Only take patches if they are root package.json patches
          if (dependency.includes("@patch:")) {
            const patchPath = getPatchPath(
              getKeyVersion(dependency, "patch").version
            );

            // if no relative path then it's root package.json patch
            if (!patchPath.match(/(\.\.\/)+/)?.length) {
              return true;
            }

            return false;
          }
          
          // Ignore if multiple versions of the same package are resolved to a single version
          // since resolutions overwrites these to a single version
          if (dependency.includes(", ")) {
            return false;
          }

          const name = getDepName(dependency);
          // we take the dependencies that is not present multiple times in the lock file
          if (dependencyMap.get(name).length === 1) {
            return true;
          }

          return false;
        })
        .reduce((resolutions, dependency) => {
          supportedProtocols.forEach((protocol) => {
            if (!dependency.includes(`@${protocol}:`)) {
              return;
            }
            const { key, version } = getKeyVersion(dependency, protocol);

            switch (protocol) {
              case "npm":
                resolutions[key] = version.includes("@")
                  ? `${protocol}:${version}`
                  : version;
                break;
              case "patch":
                if (!dependency.includes("builtin<compat/")) {
                  resolutions[key] = `${protocol}:${version.split("::")[0]}`;
                }
                break;
              case "portal":
              case "link":
                resolutions[key] = `${protocol}:${version.split("::")[0]}`;
                break;
            }
          });

          return resolutions;
        }, {});
    }

    fs.mkdirSync(dirPath, {
      recursive: true,
    });
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
  });
};
