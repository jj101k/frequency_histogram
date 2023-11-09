//@ts-check

/**
 *
 */
const GraphType = {
    Histogram: 1,
    PlainHistogram: 0,
    Raw: -1,
    RawDayOverlap: -2,
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
    #graphType = { value: GraphType.Histogram }

    /**
     * @type {boolean | undefined}
     */
    #preferLog

    /**
     *
     * @param {string} box
     * @param {number} strokeWidth
     * @param {SVGSVGElement} svg
     * @param {Scaler} scaler
     * @returns
     */
    #addAxes(box, strokeWidth, svg, scaler) {
        const [x, y, w, h] = box.split(/ /).map(v => +v)
        const axes = document.createElementNS("http://www.w3.org/2000/svg", "path")
        axes.setAttribute("d", `M ${x + w / 10} ${y} L ${x + w / 10} ${y + h - h / 10} L ${x + w} ${y + h - h / 10}`)
        axes.setAttribute("stroke-width", "" + (strokeWidth * 1.5))
        axes.setAttribute("stroke", "black")
        axes.setAttribute("fill", "none")
        svg.append(axes)

        const bottomLeft = scaler.valueAt(x, y + h)
        const topRight = scaler.valueAt(x + w, y)
        // Here, the vertical scale doesn't have a specific meaning
        const label1 = document.createElementNS("http://www.w3.org/2000/svg", "text")
        label1.textContent = "" + bottomLeft.y
        label1.style.fontSize = `${w / 75}px`
        svg.append(label1)
        label1.setAttribute("x", "" + (x + w / 10))
        label1.setAttribute("y", "" + (y + h))

        const label2 = document.createElementNS("http://www.w3.org/2000/svg", "text")
        label2.textContent = "" + topRight.y
        label2.style.fontSize = `${w / 75}px`
        svg.append(label2)
        label2.setAttribute("x", "" + (x + w - label2.getComputedTextLength()))
        label2.setAttribute("y", "" + (y + h))

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
        const transform = svg.createSVGTransform()
        transform.setTranslate(w / 10 + x / 10, y / 10)
        group.transform.baseVal.appendItem(transform)
        const transform2 = svg.createSVGTransform()
        transform2.setScale(9 / 10, 9 / 10)
        group.transform.baseVal.appendItem(transform2)
        svg.append(group)
        return group
    }

    /**
     *
     */
    #addPath() {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "")
        path.setAttribute("stroke", "red")
        path.setAttribute("stroke-width", "0.05")
        path.setAttribute("fill", "none")
        return path
    }

    /**
     *
     * @returns {SVGSVGElement}
     */
    #reinit() {
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
        return svg
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
        if (this.#preferLog === undefined) {
            return "0"
        } else if (this.#preferLog) {
            return "1"
        } else {
            return "-1"
        }
    }
    set preferLog(v) {
        switch (v) {
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
        switch (this.#graphType.value) {
            case GraphType.RawDayOverlap:
                return this.renderRawOverlap()
            case GraphType.Raw:
                return this.renderRaw()
            case GraphType.PlainHistogram:
                return this.renderPlain()
            case GraphType.Histogram:
                return this.renderDelta()
        }
    }

    #prepareHistogram() {
        if (!this.histogram) {
            return undefined
        }
        this.histogram.fieldInfo = { field: this.#field }
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
        if (!histogram) {
            return
        }
        const svg = this.#reinit()
        const cumulativeDeltas = histogram.cumulativeDeltas

        if (this.debug) {
            console.log("Deltas", cumulativeDeltas)
        }

        const scaler = new FrequencyScaler(this.#field, this.#preferLog)

        const { compiledPaths, box, strokeWidth } = scaler.renderValues(cumulativeDeltas)

        if (this.debug) {
            console.log(box, strokeWidth)
        }
        svg.setAttribute("viewBox", box)

        const group = this.#addAxes(box, strokeWidth, svg, scaler)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + strokeWidth)
            group.append(path)
        }
    }

    /**
     *
     */
    renderPlain() {
        const histogram = this.#prepareHistogram()
        if (!histogram) {
            return
        }
        const svg = this.#reinit()
        const frequencies = histogram.frequencies

        if (this.debug) {
            console.log(frequencies)
        }

        const scaler = new HistogramScaler(this.#field)

        const { compiledPaths, box, strokeWidth } = scaler.renderValues(frequencies)

        if (this.debug) {
            console.log(box, strokeWidth)
        }
        svg.setAttribute("viewBox", box)

        const group = this.#addAxes(box, strokeWidth, svg, scaler)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + strokeWidth)
            group.append(path)
        }
    }

    /**
     *
     */
    renderRaw() {
        const histogram = this.#prepareHistogram()
        if (!histogram) {
            return
        }
        const svg = this.#reinit()
        const rawValues = histogram.rawValues

        if (this.debug) {
            console.log(rawValues)
        }

        const scaler = new RawScaler(this.#field)

        const { compiledPaths, box, strokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, strokeWidth)
        }
        svg.setAttribute("viewBox", box)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + strokeWidth)
            svg.append(path)
        }
    }

    /**
     *
     */
    renderRawOverlap() {
        const histogram = this.#prepareHistogram()
        if (!histogram) {
            return
        }
        const svg = this.#reinit()
        const rawValues = histogram.rawValues

        if (this.debug) {
            console.log(rawValues)
        }

        const scaler = new RawScalerOverlap(this.#field)

        const { compiledPaths, box, strokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, strokeWidth)
        }
        svg.setAttribute("viewBox", box)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + strokeWidth)
            path.setAttribute("stroke", "rgba(255, 0, 0, 0.3)")
            svg.append(path)
        }
    }
}