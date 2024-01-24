//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./histogram.js" />
/// <reference path="./scaler.js" />

/**
 *
 */
const GraphType = {
    /**
     * Continuous histogram, ie the frequency scale of the values
     */
    Histogram: 1,
    /**
     * Discrete histogram, ie the frequency of the points
     */
    PlainHistogram: 0,
    /**
     * The literal data points
     */
    Raw: -1,
    /**
     * The data points by hour but not date
     */
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
     * @type {boolean}
     */
    #roundToNearest

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
     * @param {number} min
     * @param {number} max
     * @returns
     */
    #resampleScale(min, max) {
        const preferredScale = (max - min) / 40 // Heuristic
        const bases = [10, 5, 2]
        const preferredScaleL = Math.log2(preferredScale)
        // Round to leading 1/2/5
        const scales = bases.map(b => ({b, s: preferredScaleL / Math.log2(b)}))

        const error = (v) => Math.abs(v - Math.round(v))
        const scale = scales.sort((a, b) => error(a.s)-error(b.s))[0]
        return Math.pow(scale.b, Math.round(scale.s))
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
    get noiseReduction() {
        return this.histogram?.noiseReduction ?? false
    }

    set noiseReduction(v) {
        if(this.histogram) {
            this.histogram.noiseReduction = v
            this.render()
        }
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
     */
    get roundToNearest() {
        return this.#roundToNearest
    }

    set roundToNearest(v) {
        this.#roundToNearest = v
        if(this.histogram) {
            this.render()
        }
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
                if(this.#field.isScalar) {
                    return this.renderDelta()
                } else {
                    return this.renderPlain()
                }
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
     * Renders the continuous frequency of values (scalar only).
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

        /**
         * @type {typeof cumulativeDeltas}
         */
        let resampledDeltas
        if(this.roundToNearest && this.#field.isScalar) {
            const resampleScale = this.#resampleScale(cumulativeDeltas[0].y, cumulativeDeltas[cumulativeDeltas.length - 1].y)

            resampledDeltas = []
            /**
             * @type {typeof cumulativeDeltas[0] | undefined}
             */
            let resampledDelta
            for(const delta of cumulativeDeltas) {
                // Deltas apply to the value above this one
                const resampledY = Math.ceil(delta.y / resampleScale) * resampleScale
                if(resampledDelta?.y === resampledY) {
                    resampledDelta.f += delta.f
                } else {
                    if(resampledDelta) {
                        resampledDeltas.push(resampledDelta)
                    }
                    resampledDelta = {f: delta.f, y: resampledY}
                }
            }
            if(resampledDelta) {
                resampledDeltas.push(resampledDelta)
            }
        } else {
            resampledDeltas = cumulativeDeltas
        }

        const scaler = new FrequencyScaler(this.#field, this.#preferLog)

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(resampledDeltas)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        svg.setAttribute("viewBox", box)

        const group = this.#addAxes(box, axisStrokeWidth, svg, scaler)
        const [x, y, w, h] = box.split(/ /).map(v => +v)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath.replace(/^M -?[\d.]+ -?[\d.]+ /, `M ${x} ${y + h} `) + ` L ${x + w} ${y + h}`)

            path.setAttribute("stroke-width", "" + dataStrokeWidth)
            path.setAttribute("fill", "rgba(255, 0, 0, 0.3)")
            group.append(path)
        }
    }

    /**
     * Renders the frequency of literal values, suitable for non-scalar values
     * as well as cases where you just want to debug it.
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

        const scaler = new HistogramScaler(this.#field, this.#preferLog)

        /**
         * @type {typeof frequencies}
         */
        let resampledFrequencies
        if(this.roundToNearest && this.#field.isScalar) {
            const resampleScale = this.#resampleScale(frequencies[0].y, frequencies[frequencies.length - 1].y)

            resampledFrequencies = []
            /**
             * @type {typeof frequencies[0] | undefined}
             */
            let resampledFrequency
            for(const frequency of frequencies) {
                const resampledY = Math.round(frequency.y / resampleScale) * resampleScale
                if(resampledFrequency?.y === resampledY) {
                    resampledFrequency.f += frequency.f
                } else {
                    if(resampledFrequency) {
                        resampledFrequencies.push(resampledFrequency)
                    }
                    resampledFrequency = {f: frequency.f, y: resampledY}
                }
            }
            if(resampledFrequency) {
                resampledFrequencies.push(resampledFrequency)
            }
        } else {
            resampledFrequencies = frequencies
        }

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(resampledFrequencies)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        svg.setAttribute("viewBox", box)

        const group = this.#addAxes(box, axisStrokeWidth, svg, scaler)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + dataStrokeWidth)
            group.append(path)
        }
    }

    /**
     * Render the literal values as they are, from first date to last
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

        const scaler = new RawScaler()

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        svg.setAttribute("viewBox", box)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + dataStrokeWidth)
            svg.append(path)
        }
    }

    /**
     * Render the literal values as they are, by hour.
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

        const scaler = new RawScalerOverlap()

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        svg.setAttribute("viewBox", box)

        for(const compiledPath of compiledPaths) {
            const path = this.#addPath()
            path.setAttribute("d", compiledPath)

            path.setAttribute("stroke-width", "" + dataStrokeWidth)
            path.setAttribute("stroke", "rgba(255, 0, 0, 0.3)")
            svg.append(path)
        }
    }
}