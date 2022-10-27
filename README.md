English / [日本語](./README.ja.md)

# maplibre-geo-circle-layer

Renders a simple circle on a [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) map.

## Getting started

### Prerequisites

This library is intended to work with MapLibre GL JS v5.x.
(The latest version was developed with v5.6.2.)

### How to install

Please run the following command:
```sh
npm install https://github.com/codemonger-io/maplibre-geo-circle-layer.git#v0.1.0
```

#### Installing from GitHub Packages

Whenever commits are pushed to the `main` branch, a *developer package* is published to the npm registry managed by GitHub Packages.
A *developer package* bears the next release version but followed by a dash (`-`) plus the short commit hash; e.g., `0.1.0-abc1234` where `abc1234` is the short commit hash of the commit used to build the package (*snapshot*).
You can find *developer packages* [here](https://github.com/codemonger-io/maplibre-geo-circle-layer/pkgs/npm/maplibre-geo-circle-layer).

##### Configuring a GitHub personal access token

To install a *developer package*, you need to configure a **classic** GitHub personal access token (PAT) with at least the `read:packages` scope.
Below briefly explains how to configure a PAT.
Please refer to the [GitHub documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for more details.

Once you have a PAT, please create a `.npmrc` file in your home directory with the following contents (please replace `$YOUR_GITHUB_PAT` with your PAT):

```
//npm.pkg.github.com/:_authToken=$YOUR_GITHUB_PAT
```

In the root directory of your project, create another `.npmrc` file with the following contents:

```
@codemonger-io:registry=https://npm.pkg.github.com
```

Then you can install a *developer package* with the following command:

```sh
npm install @codemonger-io/maplibre-collision-boxes@0.1.0-abc1234
```

Please replace `abc1234` with the short commit hash of the *snapshot* you want to install.

### Usage

The following snippet adds a custom layer (`id="example-circle"`) that renders a transparent blue circle with the radius of 100 meters around Tokyo Station:
```ts
import { GeoCircleLayer } from '@codemonger-io/maplibre-geo-circle-layer';
// suppose map: maplibre-gl.Map
map.addLayer(new GeoCircleLayer('example-circle', {
    radiusInMeters: 100,
    center: { lng: 139.7671, lat: 35.6812 },
    fill: { red: 0.5, green: 0.5, blue: 1, alpha: 0.5 },
}));
```

You will see something like the following,
![example circle](./example-circle.png)

There is an example project in the [`example` folder](./example).

#### Updating properties

You can change the following properties of a [`GeoCircleLayer`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.md) after creating it.
- [`radiusInMeters`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.radiusinmeters.md): radius in meters of the circle
- [`center`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.center.md): center of the circle
- [`fill`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.fill.md): fill color of the circle
- [`numTriangles`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.numtriangles.md): number of triangles to approximate a circle

If you change any of the above properties, [`GeoCircleLayer`](./api-docs/markdown/maplibre-geo-circle-layer.geocirclelayer.md) triggers repaint of the map.

### API documentation

Please refer to the [`api-docs/markdown` folder](./api-docs/markdown/index.md).

## License

[MIT](./LICENSE)

## Development

### Prerequisites

[Node.js](https://nodejs.org/en/) version 14 or higher is required to build this library.

### Installing dependencies

```sh
pnpm install --frozen-lockfile
```

### Building the library

```sh
pnpm build
```

### Generating the API documentation

```sh
pnpm build:doc
```

This also runs `pnpm build`.

### Running type check

You can run a type checker without building the library.

```sh
pnpm type-check
```

### Running tests

```sh
pnpm test
```

### GitHub workflows

[GitHub Actions](https://github.com/features/actions) that builds and verifies the target will start when a pull-request or push is initiated to the `main` branch.

## Alternatives to this library

### Built-in circle layer

MapLibre GL JS has a [built-in circle layer](https://maplibre.org/maplibre-style-spec/layers/#circle).
It can render multiple circles on a layer, but you have to specify radiuses in pixels (screen units).
So it is not suitable for rendering a shape that circles a geographical area.

### maplibre-gl-draw-circle

[`maplibre-gl-draw-circle`](https://github.com/aws-amplify/maplibre-gl-draw-circle) offers more features than `maplibre-geo-circle-layer` does.
For instance, `maplibre-gl-circle` has an optional feature that enables interactive editing of circles.
You might prefer `maplibre-geo-circle-layer` for simplicity.