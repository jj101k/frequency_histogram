//@-check

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
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.#container = container
    }
    /**
     *
     */
    init() {
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
        this.#path = path
        this.#container.append(svg)
        this.#svg = svg
    }
    /**
     *
     * @param {Histogram} h
     */
    render(h) {
        if(!this.#svg) {
            this.init()
        }
        const cumulativeDeltas = h.cumulativeDeltas
        let lastPos = {y: cumulativeDeltas[0].y - 0.1, fV: 0}
        let dA = `M ${lastPos.y} ${lastPos.fV}`
        let minX = cumulativeDeltas[0].y
        let maxX = cumulativeDeltas[cumulativeDeltas.length - 1].y
        let minY = 0
        let maxY = -Infinity
        for(const d of cumulativeDeltas) {
            console.log(`${d.y} = ${Math.round(d.f)}`)
            const v = -d.f / 50 // -Math.log(d.f)
            const lA = `L ${d.y},${lastPos.fV} L ${d.y},${v}`
            lastPos = {y: d.y, fV: v}
            // console.log(lA)
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
    }
}