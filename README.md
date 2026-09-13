# Deploy to CapRover

Deploy checked-out source, a Docker image, or a prepared tar file to CapRover using an app token.

## Quick start

```yaml
- uses: actions/checkout@v6

- uses: caprover/deploy-from-github@v2
  with:
    server: https://captain.example.com
    app: my-api
    token: ${{ secrets.CAPROVER_APP_TOKEN }}
```

This packages the files committed in the checked-out `HEAD` and submits the deployment to CapRover. Generate an app token from the app's **Deployment** tab in CapRover.

## Deploy a Docker image

Build and push the image with the standard Docker actions, then ask CapRover to deploy it:

```yaml
- uses: actions/checkout@v6

- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/acme/my-api:${{ github.sha }}

- uses: caprover/deploy-from-github@v2
  with:
    server: https://captain.example.com
    app: my-api
    token: ${{ secrets.CAPROVER_APP_TOKEN }}
    image: ghcr.io/acme/my-api:${{ github.sha }}
```

## Monorepo

`working-directory` packages that directory's committed contents at the root of the deployment tar:

```yaml
- uses: actions/checkout@v6

- uses: caprover/deploy-from-github@v2
  with:
    server: https://captain.example.com
    app: my-api
    token: ${{ secrets.CAPROVER_APP_TOKEN }}
    working-directory: apps/api
```

## Deploy a prepared tar

Use `tar-file` when an earlier step produces the exact deployment archive:

```yaml
- uses: actions/checkout@v6

- uses: caprover/deploy-from-github@v2
  with:
    server: https://captain.example.com
    app: my-api
    token: ${{ secrets.CAPROVER_APP_TOKEN }}
    tar-file: ./dist/deploy.tar
```

## Inputs

| Input               | Required | Default | Description                                                |
| ------------------- | -------- | ------- | ---------------------------------------------------------- |
| `server`            | Yes      |         | CapRover URL, such as `https://captain.example.com`        |
| `app`               | Yes      |         | CapRover app name                                          |
| `token`             | Yes      |         | App token from the app's Deployment tab                    |
| `image`             | No       |         | Existing Docker image for CapRover to deploy               |
| `tar-file`          | No       |         | Prepared tar file, resolved from the GitHub workspace      |
| `working-directory` | No       | `.`     | Source directory whose committed contents should be packed |

`image` and `tar-file` are mutually exclusive. `working-directory` applies to source deployments.

## Private registries

CapRover pulls an image from the registry during deployment. Configure the registry credentials in CapRover before deploying a private image. Logging the GitHub runner into the registry only grants access to the runner.

## Migration from v1

- Replace `caprover/deploy-from-github@v1` with `caprover/deploy-from-github@v2` when you are ready to migrate.
- The `branch` input has been removed. Check out the desired commit before running the action; v2 always packages checked-out `HEAD`.
- The default mode now packages checked-out `HEAD` automatically.
- To deploy an existing `./deploy.tar`, provide `tar-file: ./deploy.tar` explicitly.
- Generated and uncommitted files are excluded from the default source deployment. Package them into a tar file and use `tar-file` when they are required.

App-token deployments run in detached mode. A successful action means CapRover accepted the deployment; final build and application health are handled by CapRover.
