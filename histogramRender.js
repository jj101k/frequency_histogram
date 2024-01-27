//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./histogram.js" />
/// <reference path="./renderContext.js" />
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
     */
    #renderContext

    /**
     * @type {boolean}
     */
    #roundToNearest

    /**
     *
     * @param {number} min
     * @param {number} max
     * @returns
     */
    #resampleScale(min, max) {
        const preferredScale = (max - min) / 40 // Heuristic
        // Round to leading 1/2/5
        const multiple = Math.pow(10, Math.floor(Math.log10(preferredScale)))
        const significand = preferredScale / multiple
        const scales = [1, 2, 5, 10]
        const scale = scales.sort((a, b) => Math.abs(significand - a) - Math.abs(significand - b))[0]
        return scale * multiple
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
     * @param {RenderContext} renderContext
     */
    constructor(renderContext) {
        this.#renderContext = renderContext
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
        this.#renderContext.reinit()
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
        this.#renderContext.setViewBox(box)

        const group = this.#renderContext.addAxes(axisStrokeWidth, scaler, {x: true})
        const {x, y, w, h} = box

        for(const compiledPath of compiledPaths) {
            const path = this.#renderContext.addPath()
            path.setCompiledPath(compiledPath.replace(/^M -?[\d.]+ -?[\d.]+ /, `M ${x} ${y + h} `) + ` L ${x + w} ${y + h}`)

            path.setStrokeWidth(dataStrokeWidth)
            path.setFillStyle("rgba(255, 0, 0, 0.3)")
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
        this.#renderContext.reinit()
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
        this.#renderContext.setViewBox(box)

        const group = this.#renderContext.addAxes(axisStrokeWidth, scaler, {x: true})

        for(const compiledPath of compiledPaths) {
            const path = this.#renderContext.addPath()
            path.setCompiledPath(compiledPath)

            path.setStrokeWidth(dataStrokeWidth)
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
        this.#renderContext.reinit()
        const rawValues = histogram.rawValues

        if (this.debug) {
            console.log(rawValues)
        }

        const scaler = new RawScaler()

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        this.#renderContext.setViewBox(box)

        const group = this.#renderContext.addAxes(axisStrokeWidth, scaler, {x: false})

        for(const compiledPath of compiledPaths) {
            const path = this.#renderContext.addPath()
            path.setCompiledPath(compiledPath)

            path.setStrokeWidth(dataStrokeWidth)
            group.append(path)
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
        this.#renderContext.reinit()
        const rawValues = histogram.rawValues

        if (this.debug) {
            console.log(rawValues)
        }

        const scaler = new RawScalerOverlap()

        const { compiledPaths, box, axisStrokeWidth, dataStrokeWidth } = scaler.renderValues(rawValues)

        if (this.debug) {
            console.log(box, axisStrokeWidth)
        }
        this.#renderContext.setViewBox(box)

        const group = this.#renderContext.addAxes(axisStrokeWidth, scaler, {x: false})

        for(const compiledPath of compiledPaths) {
            const path = this.#renderContext.addPath()
            path.setCompiledPath(compiledPath)

            path.setStrokeWidth(dataStrokeWidth)
            path.setStrokeStyle("rgba(255, 0, 0, 0.3)")
            group.append(path)
        }
    }
}