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
     */
    #first24 = false

    /**
     * @type {boolean | undefined}
     */
    #preferLog

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
    get first24() {
        return this.#first24
    }
    set first24(v) {
        this.#first24 = v
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
     */
    get preferLog() {
        if(this.#preferLog === undefined) {
            return "0"
        } else if(this.#preferLog) {
            return "1"
        } else {
            return "-1"
        }
    }
    set preferLog(v) {
        switch(v) {
            case "1":
                this.#preferLog = true
                break
            case "-1":
                this.#preferLog = false
                break
            case "0":
                this.#preferLog = undefined
                break
            default:
                throw new Error(`Cannot parse ${v}`)
        }
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
        this.histogram.limit = this.#first24 ? 24 : undefined
        return this.histogram
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

        const scaler = new Scaler(this.#field, this.#preferLog)

        const {dA, box, strokeWidth} = scaler.renderValues(cumulativeDeltas)

        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
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

        const scaler = new Scaler(this.#field)

        const {dA, box, strokeWidth} = scaler.renderValues(frequencies)

        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        if(this.debug) {
            console.log(strokeWidth)
        }
        this.#path.setAttribute("stroke-width", strokeWidth)
    }
}