# Deploy to CapRover

Deploy checked-out source, a Docker image, or a prepared tar file to CapRover using an app token.

## Quick start (recommended)

For most deployments, build the Docker image on GitHub Actions, push it to a registry, and ask CapRover to deploy that image.

This keeps the expensive image build off your CapRover server, avoids consuming production CPU and memory during deployments, and lets GitHub Actions handle build caching and build logs.

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

Generate an app token from the app's **Deployment** tab in CapRover.

CapRover pulls the image from the registry during deployment. If the image is private, configure the registry credentials in CapRover as well. Logging the GitHub runner into the registry only grants access to the runner.

App tokens and deployment data are sent to the configured server. Use HTTPS unless the server is reached through a trusted private network.

## Deploy source directly

For simple projects or quick testing, you can send the checked-out source directly to CapRover:

```yaml
- uses: actions/checkout@v6

- uses: caprover/deploy-from-github@v2
  with:
    server: https://captain.example.com
    app: my-api
    token: ${{ secrets.CAPROVER_APP_TOKEN }}
```

This packages the files committed in the checked-out `HEAD` and submits them to CapRover. CapRover then builds the Docker image on your server.

For production deployments, image-based deployment is strongly recommended. Building from source on the CapRover server consumes the server's CPU, memory, disk I/O, and build cache space during every deployment. Building and pushing the image in GitHub Actions keeps those build resources off the server and gives you a reusable, immutable deployment artifact.

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

Like direct source deployment, CapRover builds the resulting image on the server. Prefer deploying a pre-built image for production workloads when possible.

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
