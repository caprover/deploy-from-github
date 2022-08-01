# Deploy from Github

While there are a few ways you can deploy your app to Caprover, this Github Action leverages the official Caprover CLI to deploy your application. It is recommended to add this Github Action as final step multi-step workflow so you can build and test your apps prior to deployments.

To use this Action, you'll need 3 pieces of information saved in your project Github Secrets.

- APP_NAME secret is the name of your app, exactly as it's specified in Caprover.
- APP_TOKEN secret is obtained fromt he "Deployment" tab of your in Caprover. Click "Enable App Token" to generate a token.
- CAPROVER_SERVER secret can be set as a organization secret so it's available to all your projects. Override per project as needed.

The CAPROVER_SERVER secret is specified as the full URL of your Caprover instance, i.e. https://captain.apps.your-domain.com

A sample of how this action can be used is sourced from https://github.com/PremoWeb/SDK-Foundation-Vue/blob/main/.github/workflows/deploy.yml.

```
name: Build & Deploy

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
            puzzle-image-generator/quotefall
          outPath: deploy.tar

      - uses: caprover/deploy-from-github@v1.0.0
        with:
          server: '${{ secrets.CAPROVER_SERVER }}'
          app: '${{ secrets.APP_NAME }}'
          token: '${{ secrets.APP_TOKEN }}'

```
