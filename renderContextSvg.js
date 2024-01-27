//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./histogram.js" />
/// <reference path="./histogramRender.js" />
/// <reference path="./scaler.js" />

/**
 * @extends {RenderContext<RenderPathSvg>}
 */
class RenderContextSvg extends RenderContext {
    /**
     *
     */
    #container

    /**
     * @type {SVGSVGElement | undefined}
     */
    #svg

    /**
     * @protected
     */
    get svg() {
        let svg = this.#svg
        if (!svg) {
            const document = this.#container.ownerDocument
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.setAttribute("viewBox", "0 0 1000 1000")
            svg.style.width = "1000px"
            this.#container.append(svg)
            this.#svg = svg
        }
        return svg
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
        const {x, y, width: w, height: h} = this.svg.viewBox.baseVal
        const axes = document.createElementNS("http://www.w3.org/2000/svg", "path")
        axes.setAttribute("d", `M ${x + w / 10} ${y} L ${x + w / 10} ${y + h - h / 10} L ${x + w} ${y + h - h / 10}`)
        axes.setAttribute("stroke-width", "" + (strokeWidth * 1.5))
        axes.setAttribute("stroke", "black")
        axes.setAttribute("fill", "none")
        this.append(axes)

        if(labels.x) {
            const bottomLeft = scaler.valueAt(x, y + h)
            const topRight = scaler.valueAt(x + w, y)
            // Here, the vertical scale doesn't have a specific meaning
            const label1 = document.createElementNS("http://www.w3.org/2000/svg", "text")
            label1.textContent = "" + bottomLeft.y
            label1.style.fontSize = `${w / 75}px`
            this.append(label1)
            label1.setAttribute("x", "" + (x + w / 10))
            label1.setAttribute("y", "" + (y + h))

            const label2 = document.createElementNS("http://www.w3.org/2000/svg", "text")
            label2.textContent = "" + topRight.y
            label2.style.fontSize = `${w / 75}px`
            this.append(label2)
            label2.setAttribute("x", "" + (x + w - label2.getComputedTextLength()))
            label2.setAttribute("y", "" + (y + h))
        }

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
        const transform = this.svg.createSVGTransform()
        transform.setTranslate(w / 10 + x / 10, y / 10)
        group.transform.baseVal.appendItem(transform)
        const transform2 = this.svg.createSVGTransform()
        transform2.setScale(9 / 10, 9 / 10)
        group.transform.baseVal.appendItem(transform2)
        this.append(group)
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

    append(path) {
        this.svg.append(path)
    }

    reinit() {
        const svg = this.svg
        for(const c of [...svg.childNodes]) {
            svg.removeChild(c)
        }
    }

    setViewBox(box) {
        const {x, y, w, h} = box
        const viewBox = this.svg.viewBox.baseVal
        viewBox.x = x
        viewBox.y = y
        viewBox.width = w
        viewBox.height = h
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
        this.path.setAttribute("d", path.map(pc => `${pc.type == "move" ? "M" : "L"} ${pc.x} ${pc.y}`).join(" "))
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