/**
 * Provides a MapLibre custom layer that renders a simple circle.
 *
 * @remarks
 *
 * A circle is represented with the center and radius in meters (not pixels).
 *
 * @packageDocumentation
 */

import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from 'maplibre-gl';

import { loadShader } from './private/load-shader';
import type { LngLat, RGBA } from './types';
export { LngLat, RGBA } from './types';

/**
 * Default radius of a circle.
 *
 * @beta
 */
export const DEFAULT_RADIUS_IN_METERS = 50;

/**
 * Default center of a circle (Tokyo Station).
 *
 * @beta
 */
export const DEFAULT_CENTER = { lng: 139.7671, lat: 35.6812 } as const;

/**
 * Default fill color of a circle (opaque white).
 *
 * @beta
 */
export const DEFAULT_FILL = {
  red: 1.0,
  green: 1.0,
  blue: 1.0,
  alpha: 1.0,
} as const;

/**
 * Default number of triangles to approximate a circle.
 *
 * @beta
 */
export const DEFAULT_NUM_TRIANGLES = 32;

/**
 * Constructor properties for `GeoCircleLayer`.
 *
 * @beta
 */
export interface GeoCircleLayerProperties {
  /** Radius of the circle in meters. */
  radiusInMeters?: number;

  /** Center of the circle. */
  center?: LngLat;

  /** Fill color of the circle. */
  fill?: RGBA;

  /** Number of triangles to approximate the circle. */
  numTriangles?: number;
}

/**
 * Custom layer that renders a simple circle.
 *
 * @beta
 */
export class GeoCircleLayer implements CustomLayerInterface {
  /** Radius of the circle. */
  private _radiusInMeters: number;
  /** Center of the circle. */
  private _center: LngLat;
  /** Fill color of the circle. */
  private _fill: RGBA;
  /** Fill color for blending. Alpha is multiplied to the other components. */
  private _fillForBlending: RGBA;
  /** Number of triangles to approximate the circle. */
  private _numTriangles: number;

  /** Current map instance. */
  private map: MapLibreMap | null = null;
  /** Function that removes listeners from `map`. */
  private removeListeners: (() => void) | null = null;
  /** Maps shader variant name → WebGL program. */
  private shaderMap: Map<string, WebGLProgram> = new Map();
  /** Buffer. */
  private buffer: WebGLBuffer | null = null;
  /** Whether the buffer needs refresh. */
  private isDirty: boolean = true;

  /**
   * Initializes a layer.
   *
   * @remarks
   *
   * You may omit all or part of `props`.
   * The following are default values for the properties,
   * - `radiusInMeters`: `50`
   * - `center`: `{ lng: 139.7671, lat: 35.6812 }` (Tokyo Station)
   * - `fill`: `{ red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0 }` (white)
   * - `numTriangles`: `32`
   *
   * You do not have to premultiply the alpha to the red, gree, and blue
   * components of `fill`.
   *
   * @param id -
   *
   *   ID of the layer.
   *
   * @param props -
   *
   *   Properties of the circle.
   *
   * @throws RangeError
   *
   *   If `props.radiusInMeters` is negative,
   *   or if `props.numTriangles` is less than `3`.
   */
  constructor(
    public readonly id: string,
    props?: GeoCircleLayerProperties,
  ) {
    const radiusInMeters = props?.radiusInMeters ?? DEFAULT_RADIUS_IN_METERS;
    if (radiusInMeters < 0) {
      throw new RangeError(
        `radiusInMeters must be ≥ 0 but ${radiusInMeters} was given`,
      );
    }
    const numTriangles = props?.numTriangles ?? DEFAULT_NUM_TRIANGLES;
    if (numTriangles < 3) {
      throw new RangeError(
        `numTriangles must be ≥ 3 but ${numTriangles} was given`,
      );
    }
    this._radiusInMeters = radiusInMeters;
    this._center = props?.center ?? DEFAULT_CENTER;
    this._fill = props?.fill ?? DEFAULT_FILL;
    this._fillForBlending = multiplyAlpha(this._fill);
    this._numTriangles = numTriangles;
  }

  /** Type is always "custom". */
  get type(): 'custom' {
    return 'custom';
  }

  /**
   * Radius in meters of the circle.
   *
   * @remarks
   *
   * Updating this property will trigger repaint of the map.
   *
   * Throws `RangeError`, if a negative value is given to the setter.
   */
  get radiusInMeters(): number {
    return this._radiusInMeters;
  }
  set radiusInMeters(radiusInMeters: number) {
    if (radiusInMeters < 0) {
      throw new RangeError(
        `radiusInMeters must be ≥ 0 but ${radiusInMeters} was given`,
      );
    }
    this._radiusInMeters = radiusInMeters;
    this.triggerRepaint();
  }

  /**
   * Center of the circle.
   *
   * @remarks
   *
   * Updating this property will trigger repaint of the map.
   */
  get center(): LngLat {
    return this._center;
  }
  set center(center: LngLat) {
    this._center = center;
    this.triggerRepaint();
  }

  /**
   * Fill color of the circle.
   *
   * @remarks
   *
   * Since v0.2.0, you no longer have to premultiply the alpha to the red,
   * green, and blue components.
   *
   * Updating this property will trigger repaint of the map.
   */
  get fill(): RGBA {
    return this._fill;
  }
  set fill(fill: RGBA) {
    this._fill = fill;
    this._fillForBlending = multiplyAlpha(fill);
    // no need to recalculate the circle
    this.map?.triggerRepaint();
  }

  /**
   * Number of triangles to approximate the circle.
   *
   * @remarks
   *
   * Updating this property will trigger repaint of the map.
   *
   * Throws `RangeError`, if a value less than 3 is given to the setter.
   */
  get numTriangles(): number {
    return this._numTriangles;
  }
  set numTriangles(numTriangles: number) {
    if (numTriangles < 3) {
      throw new RangeError(
        `numTriangles must be ≥ 3 but ${numTriangles} was given`,
      );
    }
    this._numTriangles = numTriangles;
    this.triggerRepaint();
  }

  /** Requests repaint. */
  private triggerRepaint() {
    this.isDirty = true;
    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext) {
    this.map = map;
    // buffer should be recreated when the WebGL context is restored
    this.buffer = gl.createBuffer();
    // processes WebGL context events
    const onWebglcontextlost = () => {
      this.clearWebGLReferences();
    };
    const onWebglcontextrestored = () => {
      // according to the MDN documentation, the WebGL context object associated
      // with the same canvas is always the same.
      // so it should be safe to reference `gl` here.
      this.buffer = gl.createBuffer();
    };
    map.on('webglcontextlost', onWebglcontextlost);
    map.on('webglcontextrestored', onWebglcontextrestored);
    this.removeListeners = () => {
      map.off('webglcontextlost', onWebglcontextlost);
      map.off('webglcontextrestored', onWebglcontextrestored);
    };
  }

  onRemove(map: MapLibreMap, gl: WebGLRenderingContext) {
    if (this.removeListeners != null) {
      this.removeListeners();
    }
    this.clearWebGLReferences();
    this.map = null;
    this.isDirty = true;
  }

  // creates a WebGL program with given shader data.
  //
  // caches the program so that this function can return the same program when
  // the same shader variant name is requested.
  private createWebGLProgram(
    gl: WebGLRenderingContext,
    shaderData: {
      vertexShaderPrelude: string,
      define: string,
      variantName: string,
    },
  ): WebGLProgram {
    // retrieves the program from the cache, otherwise creates it
    let program = this.shaderMap.get(shaderData.variantName);
    if (program == null) {
      const vertexSource = `#version 300 es
        // Inject MapLibre projection code
        ${shaderData.vertexShaderPrelude}
        ${shaderData.define}

        in vec2 a_pos;

        void main() {
          gl_Position = projectTile(a_pos);
        }
      `.trim();
      const fragmentSource = `#version 300 es
        uniform lowp vec4 u_fill;

        out lowp vec4 fragColor;

        void main() {
          /* premultiplies the alpha to the RGB components. */
          fragColor = u_fill;
        }
      `.trim();

      // creates shaders
      const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

      // creates the program
      program = gl.createProgram()!; // everything should work even if program is null
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(
          'failed to link a program',
          gl.getProgramInfoLog(program),
        );
        throw new Error(
          `failed to link a program: ${gl.getProgramInfoLog(program)}`,
        );
      }

      // caches the program
      this.shaderMap.set(shaderData.variantName, program);
    }

    return program;
  }

  private clearWebGLReferences() {
    // no need for calling `gl.deleteXYZ` functions,
    // because WebGL resources will be released by dereferencing
    this.buffer = null;
    this.shaderMap.clear();
  }

  prerender(gl: WebGLRenderingContext) {
    // refreshes the buffer if necessary
    if (this.isDirty) {
      const buffer = this.buffer;
      if (buffer == null) {
        console.error('buffer is not ready');
        return;
      }
      this.isDirty = false;
      const center = MercatorCoordinate.fromLngLat(this._center);
      const radius =
        this._radiusInMeters * center.meterInMercatorCoordinateUnits();
      const points = [center.x, center.y];
      for (let i = 0; i < this._numTriangles; ++i) {
        const angle = 2 * Math.PI * (i / this._numTriangles);
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        points.push(x);
        points.push(y);
      }
      points.push(center.x + radius);
      points.push(center.y);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(points),
        gl.DYNAMIC_DRAW,
      );
    }
  }

  render(gl: WebGLRenderingContext, options: CustomRenderMethodInput) {
    const program = this.createWebGLProgram(gl, options.shaderData);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    const buffer = this.buffer;
    if (program == null || aPos == null || buffer == null) {
      console.error('shader is not ready');
      return;
    }

    gl.useProgram(program);

    // applies MapLibre projection data
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_fallback_matrix'),
      false,
      options.defaultProjectionData.fallbackMatrix as Float32Array,
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_matrix'),
      false,
      options.defaultProjectionData.mainMatrix as Float32Array,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'),
      ...options.defaultProjectionData.tileMercatorCoords,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, 'u_projection_clipping_plane'),
      ...options.defaultProjectionData.clippingPlane,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_projection_transition'),
      options.defaultProjectionData.projectionTransition,
    );

    const { red, green, blue, alpha } = this._fillForBlending;
    gl.uniform4fv(
      gl.getUniformLocation(program, 'u_fill'),
      [red, green, blue, alpha],
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    // we may assume BLEND is enabled and the blendFunc
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this._numTriangles + 2);
  }
}

/**
 * Multiplies the alpha component to the other three components.
 *
 * @param color -
 *
 *   Color to multiply the alpha.
 *
 * @returns
 *
 *   New RGBA object that has the alpha multiplied to the other components of
 *   `color`.
 *   
 * @beta
 */
export function multiplyAlpha({ red, green, blue, alpha }: RGBA): RGBA {
  return {
    red: red * alpha,
    green: green * alpha,
    blue: blue * alpha,
    alpha,
  };
}
