//@ts-check

/**
 *
 */
class HistogramRender {
    /**
     *
     */
    #container
    /**
     * @type {SVGPathElement | undefined}
     */
    #path
    /**
     * @type {SVGSVGElement | undefined}
     */
    #svg

    /**
     * @type {EpwNamedField}
     */
    #field

    /**
     *
     * @returns {[SVGPathElement, SVGSVGElement]}
     */
    #init() {
        const document = this.#container.ownerDocument
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("viewBox", "0 0 1000 1000")
        svg.style.width = "1000px"
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "")
        path.setAttribute("stroke", "red")
        path.setAttribute("stroke-width", "0.05")
        path.setAttribute("fill", "none")
        svg.append(path)
        this.#container.append(svg)
        return [path, svg]
    }

    /**
     * @type {Histogram | undefined}
     */
    histogram

    /**
     *
     */
    get field() {
        return this.#field
    }
    set field(v) {
        this.#field = v
        this.render()
    }

    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.#container = container
    }
    /**
     *
     */
    render() {
        if(!this.histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        this.histogram.field = this.#field
        const cumulativeDeltas = this.histogram.cumulativeDeltas
        let lastPos = {y: cumulativeDeltas[0].y - 0.1, fV: 0}
        let dA = `M ${lastPos.y} ${lastPos.fV}`
        let minX = cumulativeDeltas[0].y
        let maxX = cumulativeDeltas[cumulativeDeltas.length - 1].y
        let minY = 0
        let maxY = -Infinity

        let trueMinY = 0
        let trueMaxY = 0
        for(const d of cumulativeDeltas) {
            const v = d.f
            if(v > trueMaxY) {
                trueMaxY = v
            }
            if(v < trueMinY) {
                trueMinY = v
            }
        }

        const rescale = (maxX - minX) / ((trueMaxY - trueMinY) * 4)

        for(const d of cumulativeDeltas) {
            const v = -d.f * rescale // -Math.log(d.f)
            const lA = `L ${d.y},${lastPos.fV} L ${d.y},${v}`
            lastPos = {y: d.y, fV: v}
            dA += " " + lA
            if(v > maxY) {
                maxY = v
            }
            if(v < minY) {
                minY = v
            }
        }

        const box = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
        console.log(box)
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        const strokeWidth = `${(maxX - minX) / 800}`
        console.log(strokeWidth)
        this.#path.setAttribute("stroke-width", strokeWidth)
    }
}