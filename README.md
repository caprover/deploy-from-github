# Deploy from Github

While there are a few ways to deploy an app to Caprover, this Github Action leverages the official Caprover CLI and the App Token strategy to deploy an app directly from Github. 
This Github Action does require a deploy.tar file to be available to deploy, so an example is provided below to show how we can automagically create this file as part of a deployment workflow strategy.

To use this Action, 3 pieces of information must be obtained and stored in Github Secrets.

- APP_NAME secret is the name of your app, exactly as it's specified in Caprover.
- APP_TOKEN secret is obtained fromt he "Deployment" tab of your in Caprover. Click "Enable App Token" to generate a token.
- CAPROVER_SERVER secret can be organization-wide, per project, or per project override and in the format of https://captain.apps.your-domain.com.

In the following worfklow example, builds are triggered when commit history is pushed or pulled to the main branch. In the first step, the front-end app is built using NPM and it's output saved in dist/. The the following step, a deploy.tar file is then created from this newly minted dist/ direcotry, existing backend/ direcotry and the captain-definition file. Lastly, the newly created deploy.tar file will be sent to Caprover for deployment using the secrets stored in Github.

```
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

```

NOTE: Deployments take place within seconds after the workflow has been processed succesfully with any failed deployments sending an email alert to your email on file with Github.

For more information:

A complete Vue 3 frontend starter project that includes a PHP backend that uses this Github Action can be found at https://github.com/PremoWeb/SDK-Foundation-Vue/.
The example workflow presented on this page was sourced from https://github.com/PremoWeb/SDK-Foundation-Vue/blob/main/.github/workflows/deploy.yml.