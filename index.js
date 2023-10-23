const fs = require("fs");
const path = require("path");
const { parseSyml } = require("@yarnpkg/parsers");

const supportedProtocols = ["patch", "npm", "portal", "link"];

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
      const getDepName = (dep)=>{
        let parts = dep.trim().split("@")
        if(dep.startsWith("@")) {
          parts = parts.slice(0, 2)
        } else {
          parts = parts.slice(0, 1)
        }
        return parts.join("@")
      }
      /**
       * This will add all the dependencies that are not present multiple times in the lock file
       * as resolutions since we can't differentiate them but adding them unnecessarily has no side effect
       */
      packageJson.resolutions = lockJsonKey
        .filter((dependency) => {
          if (dependency.includes("@workspace:")) {
            return false;
          }
          // Ignore if multiple versions of the same package are resolved to a single version
          // since resolutions overwrites these to a single version
          if (dependency.includes(", ")) {
            return false;
          }
          if (
            !supportedProtocols.some((protocol) =>
              dependency.includes(`@${protocol}:`)
            )
          ) {
            return false;
          }
          const depName = getDepName(dependency)

          return (
            dependency.includes("@patch:") ||
            lockJsonKey.every((dependency2) => {
              if (dependency === dependency2) {
                return true;
              }

              return dependency2.split(",").every((dep) => {
                if (dep.includes("@patch:")) {
                  return true;
                }
                // we take only the dependencies that is not present multiple times in the lock file
                return getDepName(dep) !== depName;
              });
            })
          );
        })
        .reduce((resolutions, dependency) => {
          supportedProtocols.forEach((protocol) => {
            if (!dependency.includes(`@${protocol}:`)) {
              return;
            }
            const [key, version] = dependency.trim().split(`@${protocol}:`);
            switch(protocol) {
              case "npm":
                resolutions[key] = version.includes("@")
                  ? `${protocol}:${version}`
                  : version;
                break
              case "patch":
                if (!dependency.includes("builtin<compat/")) {
                  resolutions[key] = `${protocol}:${version.split("::")[0]}`;
                }
                break
              case "portal":
              case "link":
                resolutions[key] = `${protocol}:${version.split("::")[0]}`;
                break
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
