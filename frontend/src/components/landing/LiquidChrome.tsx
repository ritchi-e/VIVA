import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

/**
 * Iridescent "liquid chrome" field: layered trigonometric domain warping lit by a
 * hyperbolic falloff, which produces the thin specular streaks that read as brushed
 * metal. The pointer adds a decaying ripple so the surface tracks the cursor.
 */
const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uAmplitude;
uniform vec3 uBase;
uniform vec3 uIris;

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (2.0 * frag - uResolution) / min(uResolution.x, uResolution.y);

  for (float i = 1.0; i < 7.0; i++) {
    uv.x += uAmplitude / i * cos(i * 2.4 * uv.y + uTime * 0.55);
    uv.y += uAmplitude / i * cos(i * 1.6 * uv.x + uTime * 0.42);
  }

  vec2 pointerDelta = frag / uResolution - uPointer;
  float pointerDist = length(pointerDelta);
  uv += sin(9.0 * pointerDist - uTime * 1.6) * 0.06 * exp(-pointerDist * 6.0);

  float streak = abs(sin(uTime * 0.35 - uv.y - uv.x));
  vec3 chrome = uBase / max(streak, 0.035);

  // Split the channels slightly out of phase for the oil-slick iridescence.
  float sheen = abs(sin(uTime * 0.22 - uv.y * 1.4 + uv.x * 0.6));
  chrome += uIris * pow(1.0 - min(sheen, 1.0), 6.0) * 0.55;

  float vignette = smoothstep(1.9, 0.15, length(uv) * 0.75);
  gl_FragColor = vec4(chrome * vignette, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function LiquidChrome({
  className,
  amplitude = 0.42,
  base = [0.016, 0.072, 0.066],
  iris = [0.04, 0.42, 0.34],
  speed = 1,
}: {
  className?: string
  amplitude?: number
  base?: [number, number, number]
  iris?: [number, number, number]
  speed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 })
  // Palette props arrive as fresh array literals each render; hold them in a ref so
  // the GL context is built once instead of on every parent re-render.
  const paletteRef = useRef({ base, iris })
  paletteRef.current = { base, iris }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uPointer = gl.getUniformLocation(program, 'uPointer')
    gl.uniform1f(gl.getUniformLocation(program, 'uAmplitude'), amplitude)
    gl.uniform3fv(gl.getUniformLocation(program, 'uBase'), paletteRef.current.base)
    gl.uniform3fv(gl.getUniformLocation(program, 'uIris'), paletteRef.current.iris)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      const width = Math.floor(canvas.clientWidth * dpr)
      const height = Math.floor(canvas.clientHeight * dpr)
      if (width === 0 || height === 0) return
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.uniform2f(uResolution, width, height)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerRef.current.tx = (event.clientX - rect.left) / rect.width
      pointerRef.current.ty = 1 - (event.clientY - rect.top) / rect.height
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    let raf = 0
    let elapsed = 0
    let last = performance.now()

    const render = (now: number) => {
      raf = requestAnimationFrame(render)
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!visible) return

      if (!reduced) elapsed += delta * speed
      const pointer = pointerRef.current
      pointer.x += (pointer.tx - pointer.x) * 0.06
      pointer.y += (pointer.ty - pointer.y) * 0.06

      gl.uniform1f(uTime, elapsed)
      gl.uniform2f(uPointer, pointer.x, pointer.y)
      gl.uniform3fv(gl.getUniformLocation(program, 'uBase'), paletteRef.current.base)
      gl.uniform3fv(gl.getUniformLocation(program, 'uIris'), paletteRef.current.iris)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [amplitude, speed])

  return <canvas ref={canvasRef} aria-hidden className={cn('h-full w-full', className)} />
}
