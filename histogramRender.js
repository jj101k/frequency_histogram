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
     *
     */
    #plain = false

    /**
     * @type {SVGSVGElement | undefined}
     */
    #svg

    /**
     * @type {EpwNamedNumberField}
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
     *
     */
    debug = false

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
     */
    get plain() {
        return this.#plain
    }
    set plain(v) {
        this.#plain = v
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
     * @returns
     */
    render() {
        if(this.plain) {
            return this.renderPlain()
        } else {
            return this.renderDelta()
        }
    }

    #prepareHistogram() {
        if(!this.histogram) {
            return undefined
        }
        this.histogram.fieldInfo = {field: this.#field}
        return this.histogram
    }

    /**
     *
     * @param {{y: number}[]} values
     * @returns
     */
    #firstPos(values) {
        return {y: values[0].y - 0.1, fV: 0}
    }

    /**
     *
     */
    renderDelta() {
        const histogram = this.#prepareHistogram()
        if(!histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        const cumulativeDeltas = histogram.cumulativeDeltas

        if (this.debug) {
            console.log(cumulativeDeltas)
        }

        const firstPos = this.#firstPos(cumulativeDeltas)

        const scaler = new Scaler(this.#field, firstPos)

        const {dA, box, maxX, minX} = scaler.test3(cumulativeDeltas, firstPos)

        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        const strokeWidth = `${(maxX - minX) / 800}`
        if(this.debug) {
            console.log(strokeWidth)
        }
        this.#path.setAttribute("stroke-width", strokeWidth)
    }

    /**
     *
     */
    renderPlain() {
        const histogram = this.#prepareHistogram()
        if(!histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        const frequencies = histogram.frequencies

        if(this.debug) {
            console.log(frequencies)
        }

        const firstPos = this.#firstPos(frequencies)

        const scaler = new Scaler(this.#field, firstPos)

        const {dA, box, maxX, minX} = scaler.test3(frequencies, firstPos)

        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        const strokeWidth = `${(maxX - minX) / 800}`
        if(this.debug) {
            console.log(strokeWidth)
        }
        this.#path.setAttribute("stroke-width", strokeWidth)
    }
}