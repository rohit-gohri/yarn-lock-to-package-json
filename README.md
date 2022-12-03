# yarn-lock-to-package-json

A simple script to be used in Dockerfile to do yarn install without copying all `package.json`s in a monorepo workspace. Use case inspired by [pnpm's fetch command](https://pnpm.io/cli/fetch) but for Yarn Berry.

## Usage in Dockerfile

```Dockerfile
# ------------------------------------------------------------------------------
# First image (install dependencies)
# ------------------------------------------------------------------------------
FROM node:16-alpine as yarn
LABEL stage=yarn

WORKDIR /workspace

COPY .yarn ./.yarn
COPY yarn.lock .yarnrc.yml ./

RUN npx yarn-lock-to-package-json

RUN yarn install --immutable
# ------------------------------------------------------------------------------
# Server image (build image with production dependencies only)
# ------------------------------------------------------------------------------
FROM yarn as server
LABEL stage=server

WORKDIR /workspace

# Overwrite dummy package.json with actual ones (so that we can use scripts)
COPY package.json ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN yarn workspaces foreach -tR --from @workspace-name/server run build

RUN cd apps/server && yarn workspaces focus --production

CMD ["yarn", "workspace", "@workspace-name/server", "start"]
```

## Working

What it does is parse the lockfile and recreate the monorepo structure by creating dummy `package.json` for each package in the workspace. These dummy package.json don't invalidate your docker cache when you change a script or increment a version and so your docker build cache remains valid up to the layer of `RUN yarn install --immutable`.

Test it by copying your `yarn.lock` to a new folder and run `npx yarn-lock-to-package-json`.
