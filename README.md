# Deploy from Github

This Github Action leverages the official Caprover CLI and the App Token strategy to deploy an app directly from Github.
An example workflow provided below, shows how we can automagically create a deploy.tar file as a required part of a build & deployment strategy.

Using this Github Action requires the following three pieces of information to be entered into Github Secrets for your project repository:

- `app` secret is the name of your app, exactly as it's specified in Caprover.
- `token` secret is obtained fromt he "Deployment" tab of the app in Caprover. Click "Enable App Token" to generate a token.
- `server` secret can be organization-wide, per project, or per project override and in the format of https://captain.apps.your-domain.com.
Optional:
- `image` secret can be used to specify the specific image you want to deploy, this is particularly useful when you want to build on Github.
- `branch` secret can be used to specify the branch you want to deploy to CapRover.
- If `image` and `branch` are empty, this action expects a tar file located at the root of the project `./deploy.tar` to deploy



### Example 1 - deploy using image:
This method is preferred because you end up using Github servers to build your image and your own CapRover server just receives the built image. This is very useful specially if your server resources are limited.
Specify `CAPROVER_APP_TOKEN` and `CAPROVER_HOST` as secret in your repo. Also change `env` section in the action and you're good to go!


```yaml
name: Deploy to staging

env:
    CONTEXT_DIR: './'
    IMAGE_NAME: ${{ github.repository }}/staging
    DOCKERFILE: Dockerfile.staging
    CAPROVER_APP: myapp-staging
    DOCKER_REGISTRY: ghcr.io

on:
    push:
        branches:
            - main
        # you can specify path if you have a monorepo and you want to deploy if particular directory is changed, make sure to update `CONTEXT_DIR` too
        # paths:
        #   - "backend-app/**"

jobs:
    build-and-publish:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v1
            - run: |
                  echo "IMAGE_NAME_WITH_REGISTRY=$DOCKER_REGISTRY/$IMAGE_NAME" >> $GITHUB_ENV
                  export IMAGE_NAME_WITH_REGISTRY=$DOCKER_REGISTRY/$IMAGE_NAME
                  echo "FULL_IMAGE_NAME=$IMAGE_NAME_WITH_REGISTRY:$GITHUB_SHA-gitsha" >> $GITHUB_ENV
                  echo "CAPROVER_GIT_COMMIT_SHA=$GITHUB_SHA" >> $GITHUB_ENV
            - name: Log in to the Container registry
              uses: docker/login-action@f054a8b539a109f9f41c372932f1ae047eff08c9
              with:
                  registry: ${{ env.DOCKER_REGISTRY }}
                  username: ${{ github.actor }}
                  password: ${{ secrets.GITHUB_TOKEN }}
            - name: Build and Push Release to DockerHub
              shell: bash
              run: ./build_and_push.sh
            - name: Deploy to CapRover
              uses: caprover/deploy-from-github@d76580d79952f6841c453bb3ed37ef452b19752c
              with:
                  server: ${{ secrets.CAPROVER_HOST }}
                  app: ${{ env.CAPROVER_APP }}
                  token: '${{ secrets.CAPROVER_APP_TOKEN }}'
                  image: '${{ env.FULL_IMAGE_NAME }}'

```

`build_and_push.sh`
```bash
#!/bin/bash

set -e

cd $CONTEXT_DIR
rm /tmp/build_args || echo OK
env >/tmp/build_args
echo "--build-arg \""$(cat /tmp/build_args | sed -z 's/\n/" --build-arg "/g')"IGNORE_VAR=IGNORE_VAR\"" >/tmp/build_args
BUILD_ARGS=$(cat /tmp/build_args)
COMMAND="docker build -t $FULL_IMAGE_NAME -t $IMAGE_NAME_WITH_REGISTRY:latest -f $DOCKERFILE $BUILD_ARGS --no-cache ."
/bin/bash -c "$COMMAND"
docker push $IMAGE_NAME_WITH_REGISTRY:latest
docker push $FULL_IMAGE_NAME
rm /tmp/build_args

```

### Example 2 - deploy using `./deploy.tar`

The example workflow contains a few steps to process your source code into a deployed app in Caprover. The first step uses the a CI/CD version of Node Package Manager (NPM) to build the front-end from source code. The second step packages up your newly minted dist/ directory, the existing backend/ directory and captain-definition file into a deploy.tar file. In the last step the deploy.tar file is picked up by this Github Action and using the provided secrets, will send the file to the Caprover server where it will be deployed.

```yaml
name: Build App & Deploy

on:
  push:
    branches: [ "main" ]

  pull_request:
    branches: [ "main" ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x]

    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: "npm"
      - run: npm ci
      - run: npm run build --if-present
      - run: npm run test --if-present

      # Future plans in the works to create tarball from within the caprover/deploy-from-github action.
      - uses: a7ul/tar-action@v1.1.0
        with:
          command: c
          cwd: "./"
          files: |
            backend/
            frontend/dist/
            captain-definition
          outPath: deploy.tar

      - uses: caprover/deploy-from-github@main
        with:
          server: '${{ secrets.CAPROVER_SERVER }}'
          app: '${{ secrets.APP_NAME }}'
          token: '${{ secrets.APP_TOKEN }}'
          branch: '${{ secrets.DEPLOY_BRANCH }}' # optional
          image: '${{ secrets.DEPLOY_IMAGE }}' # optional

```

NOTE: Deployments take place within seconds after the workflow has been processed succesfully with any failed deployments sending an email alert to your email on file with Github.

For more information:

A complete Vue 3 frontend starter project that includes a PHP backend that uses this Github Action can be found at https://github.com/PremoWeb/SDK-Foundation-Vue/.
The example workflow presented on this page was sourced from https://github.com/PremoWeb/SDK-Foundation-Vue/blob/main/.github/workflows/deploy.yml.
