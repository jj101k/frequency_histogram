//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./histogram.js" />
/// <reference path="./histogramRender.js" />
/// <reference path="./scaler.js" />

/**
 *
 */
class RenderContextSvg extends RenderContext {
    /**
     * @readonly
     */
    svg

    /**
     *
     * @param {SVGSVGElement} svg
     */
    constructor(svg) {
        super()
        this.svg = svg
    }

    append(path) {
        this.svg.append(path)
    }

    setViewBox(box) {
        this.svg.setAttribute("viewBox", box)
    }
}

/**
 *
 */
class RenderPathSvg extends RenderPath {
    /**
     *
     */
    path
    /**
     *
     * @param {SVGPathElement} path
     */
    constructor(path) {
        super()
        this.path = path
    }

    setCompiledPath(path) {
        this.path.setAttribute("d", path)
    }
    setFillStyle(style) {
        this.path.setAttribute("fill", style)
    }
    setStrokeStyle(style) {
        this.path.setAttribute("stroke", style)
    }
    setStrokeWidth(width) {
        this.path.setAttribute("stroke-width", "" + width)
    }
}

/**
 *
 */
class HistogramRenderSvg extends HistogramRender {
    /**
     *
     */
    #container

    /**
     * @type {SVGSVGElement | undefined}
     */
    #svg

    /**
     *
     * @param {string} box
     * @param {number} strokeWidth
     * @param {RenderContextSvg} context
     * @param {Scaler} scaler
     * @returns
     */
    addAxes(box, strokeWidth, context, scaler) {
        const [x, y, w, h] = box.split(/ /).map(v => +v)
        const axes = document.createElementNS("http://www.w3.org/2000/svg", "path")
        axes.setAttribute("d", `M ${x + w / 10} ${y} L ${x + w / 10} ${y + h - h / 10} L ${x + w} ${y + h - h / 10}`)
        axes.setAttribute("stroke-width", "" + (strokeWidth * 1.5))
        axes.setAttribute("stroke", "black")
        axes.setAttribute("fill", "none")
        context.append(axes)

        const bottomLeft = scaler.valueAt(x, y + h)
        const topRight = scaler.valueAt(x + w, y)
        // Here, the vertical scale doesn't have a specific meaning
        const label1 = document.createElementNS("http://www.w3.org/2000/svg", "text")
        label1.textContent = "" + bottomLeft.y
        label1.style.fontSize = `${w / 75}px`
        context.append(label1)
        label1.setAttribute("x", "" + (x + w / 10))
        label1.setAttribute("y", "" + (y + h))

        const label2 = document.createElementNS("http://www.w3.org/2000/svg", "text")
        label2.textContent = "" + topRight.y
        label2.style.fontSize = `${w / 75}px`
        context.append(label2)
        label2.setAttribute("x", "" + (x + w - label2.getComputedTextLength()))
        label2.setAttribute("y", "" + (y + h))

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
        const transform = context.svg.createSVGTransform()
        transform.setTranslate(w / 10 + x / 10, y / 10)
        group.transform.baseVal.appendItem(transform)
        const transform2 = context.svg.createSVGTransform()
        transform2.setScale(9 / 10, 9 / 10)
        group.transform.baseVal.appendItem(transform2)
        context.append(group)
        return {
            append: (rpath) => group.append(rpath.path)
        }
    }

    addPath() {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "")
        path.setAttribute("stroke", "red")
        path.setAttribute("stroke-width", "0.05")
        path.setAttribute("fill", "none")
        return new RenderPathSvg(path)
    }

    reinit() {
        let svg = this.#svg
        if (!svg) {
            const document = this.#container.ownerDocument
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.setAttribute("viewBox", "0 0 1000 1000")
            svg.style.width = "1000px"
            this.#container.append(svg)
            this.#svg = svg
        }
        for(const c of [...svg.childNodes]) {
            svg.removeChild(c)
        }
        return new RenderContextSvg(svg)
    }

    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        super()
        this.#container = container
    }
}