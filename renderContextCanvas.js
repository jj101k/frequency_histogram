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
     * @protected
     */
    get canvas() {
        let canvas = this.#canvas
        if (!canvas) {
            const document = this.#container.ownerDocument
            canvas = document.createElement("canvas")
            canvas.width = 1000
            canvas.height = 1000
            canvas.style.width = "1000px"
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

    addAxes(box, strokeWidth, scaler) {
        const [x, y, w, h] = box.split(/ /).map(v => +v)
        const context = this.canvas.getContext("2d")
        if(!context) {
            throw new Error("No context")
        }
        context.translate(x, y)
        context.scale(2000/w, 500 / h) // TODO

        context.beginPath()
        context.moveTo(x + w / 10, y)
        context.lineTo(x + w / 10, y + h - h / 10)
        context.lineTo(x + w, y + h - h / 10)
        context.strokeStyle = "black"
        context.lineWidth = strokeWidth * 1.5
        context.stroke()

        const bottomLeft = scaler.valueAt(x, y + h)
        const topRight = scaler.valueAt(x + w, y)

        context.translate(10, 10)

        // Here, the vertical scale doesn't have a specific meaning

        context.font = `${w / 75}px sans-serif`
        context.fillText("" + bottomLeft.y, x + w / 10, y + h)
        const metrics = context.measureText("" + bottomLeft.y)

        context.fillText("" + topRight.y, x + w - metrics.width, y + h)

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
        context.fillRect(0, 0, 1000, 1000)
    }

    setViewBox(box) {
        const [x, y, w, h] = box.split(/ /).map(v => +v) // TODO

        this.canvas.width = 2000
        this.canvas.height = 2000
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