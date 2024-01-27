//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./histogram.js" />
/// <reference path="./histogramRender.js" />
/// <reference path="./scaler.js" />

/**
 * @extends {RenderContext<RenderPathCanvas>}
 */
class RenderContextCanvas extends RenderContext {
    /**
     *
     */
    #container

    /**
     * @type {HTMLCanvasElement | undefined}
     */
    #canvas

    /**
     *
     */
    #outerSize = {x: 1000, y: 500}

    /**
     *
     */
    #pixelDensity = 2

    /**
     *
     */
    #viewBox = {x: 0, y: 0, w: 2000, h: 1000}

    /**
     * @protected
     */
    get canvas() {
        let canvas = this.#canvas
        if (!canvas) {
            const document = this.#container.ownerDocument
            canvas = document.createElement("canvas")
            canvas.width = this.#outerSize.x * this.#pixelDensity
            canvas.height = this.#outerSize.y * this.#pixelDensity
            canvas.style.width = `${this.#outerSize.x}px`
            canvas.style.height = `${this.#outerSize.y}px`
            this.#container.append(canvas)
            this.#canvas = canvas
        }
        return canvas
    }

    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        super()
        this.#container = container
    }

    addAxes(strokeWidth, scaler, labels) {
        const {x, y, w, h} = this.#viewBox
        const context = this.canvas.getContext("2d")
        if(!context) {
            throw new Error("No context")
        }
        context.scale(this.#outerSize.x * this.#pixelDensity/w, this.#outerSize.x * this.#pixelDensity/w)
        context.translate(-x, -y)
        context.translate(-w/20, w/20)

        context.save()

        context.beginPath()
        context.moveTo(x + w / 10, y)
        context.lineTo(x + w / 10, y + h - h / 10)
        context.lineTo(x + w, y + h - h / 10)
        context.strokeStyle = "black"
        context.lineWidth = strokeWidth * 1.5
        context.stroke()

        const bottomLeft = scaler.valueAt(x, y + h)
        const topRight = scaler.valueAt(x + w, y)

        if(labels.x) {
            context.fillStyle = "black"
            context.font = `${w / 75}px sans-serif`
            context.fillText("" + bottomLeft.y, x + w / 10, y + h)
            const metrics = context.measureText("" + bottomLeft.y)

            context.fillText("" + topRight.y, x + w - metrics.width, y + h)
        }

        context.restore()
        context.translate(w / 10 + x / 10, y / 10)
        context.scale(9 / 10, 9 / 10)
        return this
    }

    addPath() {
        return new RenderPathCanvas()
    }

    /**
     *
     * @param {RenderPathCanvas} path
     */
    append(path) {
        const context = this.canvas.getContext("2d")
        if(!context) {
            throw new Error("No context")
        }
        context.beginPath()
        let p = path.compiledPath
        while(p) {
            let md
            const l = /^L ([^ ]+) ([^ ]+)/
            const m = /^M ([^ ]+) ([^ ]+)/
            if(md = p.match(m)) {
                p = p.replace(m, "")
                context.moveTo(+md[1], +md[2])
            } else if(md = p.match(l)) {
                p = p.replace(l, "")
                context.lineTo(+md[1], +md[2])
            } else  {
                throw new Error("Parse failure at: " + p)
            }
            p = p.replace(/^ */, "")
        }
        if(path.fillStyle != "none") {
            context.fillStyle = path.fillStyle
            context.fill()
        }
        context.strokeStyle = path.strokeStyle
        context.lineWidth = path.strokeWidth
        context.stroke()
    }

    reinit() {
        const context = this.canvas.getContext("2d")
        if(!context) {
            throw new Error("No context")
        }
        context.resetTransform()
        context.fillStyle = "rgb(240,240,240)"
        context.fillRect(0, 0, this.#outerSize.x * this.#pixelDensity, this.#outerSize.y * this.#pixelDensity)
    }

    setViewBox(box) {
        this.#viewBox = box
    }
}

/**
 *
 */
class RenderPathCanvas extends RenderPath {
    /**
     *
     */
    compiledPath = ""
    /**
     *
     */
    fillStyle = "none"
    /**
     *
     */
    strokeStyle = "red"
    /**
     *
     */
    strokeWidth = 0.05

    setCompiledPath(path) {
        this.compiledPath = path
    }
    setFillStyle(style) {
        this.fillStyle = style
    }
    setStrokeStyle(style) {
        this.strokeStyle = style
    }
    setStrokeWidth(width) {
        this.strokeWidth = width
    }
}