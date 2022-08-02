# Deploy from Github

This Github Action leverages the official Caprover CLI and the App Token strategy to deploy an app directly from Github.
An example workflow provided below, shows how we can automagically create a deploy.tar file as a required part of a build & deployment strategy.

Using this Github Action requires the following three pieces of information to be entered into Github Secrets for your project repository:

- APP_NAME secret is the name of your app, exactly as it's specified in Caprover.
- APP_TOKEN secret is obtained fromt he "Deployment" tab of the app in Caprover. Click "Enable App Token" to generate a token.
- CAPROVER_SERVER secret can be organization-wide, per project, or per project override and in the format of https://captain.apps.your-domain.com.

The example workflow contains a few steps to process your source code into a deployed app in Caprover. The first step uses the a CI/CD version of Node Package Manager (NPM) to build the front-end from source code. The second step packages up your newly minted dist/ directory, the existing backend/ directory and captain-definition file into a deploy.tar file. In the last step the deploy.tar file is picked up by this Github Action and using the provided secrets, will send the file to the Caprover server where it will be deployed.

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