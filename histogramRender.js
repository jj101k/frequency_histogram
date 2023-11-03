//@ts-check

/**
 *
 */
const GraphType = {
    Histogram: 1,
    PlainHistogram: 0,
    Raw: -1,
}

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
     * @type {EpwNamedNumberField}
     */
    #field

    /**
     * @type {{year: number, month: number} | undefined}
     */
    #period

    /**
     *
     */
    #first24 = false

    /**
     * @type {{value: number}}
     */
    #graphType = {value: GraphType.Histogram}

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
    get graphType() {
        return this.#graphType
    }
    set graphType(v) {
        this.#graphType = v
        this.render()
    }

    /**
     *
     */
    get period() {
        return this.#period
    }
    set period(v) {
        this.#period = v
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
        switch(this.#graphType.value) {
            case GraphType.Raw:
                return this.renderRaw()
            case GraphType.PlainHistogram:
                return this.renderPlain()
            case GraphType.Histogram:
                return this.renderDelta()
        }
    }

    #prepareHistogram() {
        if(!this.histogram) {
            return undefined
        }
        this.histogram.fieldInfo = {field: this.#field}
        this.histogram.limit = this.#first24 ? 24 : undefined
        const period = this.#period
        this.histogram.filter = period?.year ? (row) => (row.get(EpwFields[0]) == period.year && row.get(EpwFields[1]) == period.month) : undefined
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
            console.log("Deltas", cumulativeDeltas)
        }

        const scaler = new HistogramScaler(this.#field, this.#preferLog)

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

        const scaler = new HistogramScaler(this.#field)

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

    /**
     *
     */
    renderRaw() {
        const histogram = this.#prepareHistogram()
        if(!histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        const rawValues = histogram.rawValues

        if(this.debug) {
            console.log(rawValues)
        }

        const scaler = new RawScaler(this.#field)

        const {dA, box, strokeWidth} = scaler.renderValues(rawValues)

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