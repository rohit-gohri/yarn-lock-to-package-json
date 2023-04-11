const fs = require("fs");
const path = require("path");
const { parseSyml } = require("@yarnpkg/parsers");

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
      packageJson.workspaces = {
        packages: packagesConfig,
      };
      const lockJsonKey = Object.keys(lockJson)
      packageJson.resolutions = lockJsonKey.filter((dependency) => {
        if(dependency.includes("@workspace:")){
          return false;
        }
        if(dependency.includes(", ")){
          return false;
        }
        if(!dependency.includes("@npm:")){
          return false;
        }
        const [key] = dependency.split(":")
        return lockJsonKey.every(dependency2=>{
          if(dependency===dependency2){
            return true;
          }
          // we take only the dependencies that is not present multiple times in the lock file
          return dependency2.split(",").map(dep=>dep.trim().split(":")[0]).every(dep=>dep !== key);
        });
      }).reduce((resolutions, dependency) => {
        const [key, version] = dependency.trim().split("@npm:");
        resolutions[key] = version;
        return resolutions
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
}
