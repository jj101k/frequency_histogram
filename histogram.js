//@ts-check
/// <reference path="epwDataFormat.js" />
/// <reference path="epwParser.js" />
/// <reference path="histogramDeltas.js" />
/// <reference path="histogramDeltasNoiseReduced.js" />
/// <reference path="scaler.js" />

/**
 *
 */
class Histogram {
    /**
     * @type {{deltas: {y: number, dF: number, zeroSpan?: undefined}[], zeroWidthPoints: {y: number,
     * zeroSpan: number, dataSource: number}[], zeroDeltaSpan: number} | undefined}
     */
    #deltaInfo

    /**
     * @type {{field: EpwNamedNumberField, expectedMinResolution?: number | undefined}}
     */
    #fieldInfo

    /**
     * @type {((value: EpwRow) => boolean) | undefined}
     */
    #filter

    /**
     * @type {{y: number, f: number}[] | undefined}
     */
    #frequencies

    /**
     * @type {number | undefined}
     */
    #limit

    /**
     *
     */
    #noiseReduction = false

    /**
     *
     */
    #parser

    /**
     *
     */
    #raw = false

    /**
     *
     * @param {Record<number, {y: number, f: number}[]>} orderedFrequenciesRealByDS
     * @returns
     */
    #getAcceptedValues(orderedFrequenciesRealByDS) {
        const scaler = new FrequencyScaler(this.#fieldInfo.field)
        /**
         * @type {Record<number, Set<number>>}
         */
        const acceptedValuesByDS = {}
        for(const [ds, orderedFrequenciesReal] of Object.entries(orderedFrequenciesRealByDS)) {
            if(orderedFrequenciesReal.length <= 2) {
                acceptedValuesByDS[ds] = new Set(orderedFrequenciesReal.map(f => f.y))
                continue
            }
            /**
             * @type {Set<number>}
             */
            const acceptedValues = new Set()
            let last = orderedFrequenciesReal[0]
            acceptedValues.add(last.y)

            let i = 0
            for (const v of orderedFrequenciesReal.slice(1)) {
                // Note these values are flipped
                const dv = scaler.displayY(v)
                // f0: It's >20% of the previous accepted value
                if (5 * dv < scaler.displayY(last)) {
                    last = v
                    acceptedValues.add(v.y)
                } else {
                    // f1: It's >20% of the mean of the next 10 pending
                    // values
                    const n10mean = orderedFrequenciesReal.slice(i+1, i+1+10).reduce((p, c) => ({t: p.t + scaler.displayY(c), c: p.c + 1}), {t: 0, c: 0})
                    if(n10mean.c && 5 * dv < n10mean.t / n10mean.c) {
                        last = v
                        acceptedValues.add(v.y)
                    }
                }
                i++
            }
            if(acceptedValues.size < 2) {
                console.warn(orderedFrequenciesReal, acceptedValues)
                throw new Error(`Internal error: noise reduction produced ${acceptedValues.size} values from ${orderedFrequenciesReal.length}`)
            }
            acceptedValuesByDS[ds] = acceptedValues
        }

        return acceptedValuesByDS
    }

    /**
     *
     * @param {{x: number, y: number, dataSource: number}[]} dataPoints
     * @returns
     */
    #getOrderedFrequencies(dataPoints) {
        /**
         * @type {Record<number, Record<number, number>>}
         */
        const frequenciesByDS = {}
        for (const dataPoint of dataPoints) {
            if (dataPoint.y === undefined || dataPoint.y === null) {
                continue
            }
            if (!frequenciesByDS[dataPoint.dataSource]) {
                frequenciesByDS[dataPoint.dataSource] = {}
            }
            const frequencies = frequenciesByDS[dataPoint.dataSource]
            if (!frequencies[dataPoint.y]) {
                frequencies[dataPoint.y] = 0
            }
            frequencies[dataPoint.y]++
        }
        const orderedFrequenciesReal = Object.fromEntries(
            Object.entries(frequenciesByDS).map(([i, frequencies]) => [i,
                Object.entries(frequencies).map(([y, f]) => ({ y: +y, f })).sort((a, b) => a.y - b.y)])
        )
        return orderedFrequenciesReal
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.getDeltas()
        }
        const orderedFrequencies = this.#noiseReduction ? this.#getOrderedFrequencies(this.rawValues) : undefined
        if(orderedFrequencies && Object.keys(orderedFrequencies).length > 1) {
            return new HistogramDeltasNoiseReduced(this.#deltaInfo.deltas, this.#deltaInfo.zeroDeltaSpan, this.#deltaInfo.zeroWidthPoints,
                this.#getAcceptedValues(orderedFrequencies)).combined
        } else {
            return new HistogramDeltas(this.#deltaInfo.deltas, this.#deltaInfo.zeroDeltaSpan, this.#deltaInfo.zeroWidthPoints).combined
        }
    }

    /**
     *
     */
    get cumulativeDeltas() {
        /**
         * @type {{y: number, f: number}[]}
         */
        const cumulativeDeltas = []
        const combined = this.combined
        const combinedDeltas = combined.combinedDeltas
        if(combinedDeltas.length) {
            let f = 0
            for(const d of combinedDeltas) {
                f += d.dF
                cumulativeDeltas.push({y: d.y, f})
            }
        }

        return cumulativeDeltas
    }

    get deltas() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.getDeltas()
        }
        return this.#deltaInfo.deltas.slice()
    }

    /**
     *
     */
    get expectedMinDeltaY() {
        let expectedMinDeltaY = this.#fieldInfo.expectedMinResolution
        if(expectedMinDeltaY === undefined) {
            const dataPoints = this.rawValues
            /**
             * @type {Set<number>}
             */
            const yValues = new Set()
            for(const dataPoint of dataPoints) {
                if(dataPoint.y !== null && dataPoint.y !== undefined) {
                    yValues.add(dataPoint.y)
                }
            }
            if(yValues.size > 1) {
                let realMinDeltaY = Infinity
                const yValuesOrdered = [...yValues].sort((a, b) => a - b)
                let lastYValue = yValuesOrdered[0]
                for(const yValue of yValuesOrdered.slice(1)) {
                    const deltaY = yValue - lastYValue
                    if(deltaY < realMinDeltaY) {
                        realMinDeltaY = deltaY
                    }
                    lastYValue = yValue
                }

                expectedMinDeltaY = realMinDeltaY
            } else {
                console.warn("Not enough distinct values for a delta calculation, will use 1")
                expectedMinDeltaY = 1
            }
        }

        return expectedMinDeltaY
    }

    get frequencies() {
        if(!this.#frequencies) {
            this.#frequencies = this.getFrequencies()
        }
        return this.#frequencies.slice()
    }

    /**
     *
     */
    get fieldInfo() {
        return this.#fieldInfo
    }
    set fieldInfo(v) {
        this.#fieldInfo = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     */
    get filter() {
        return this.#filter
    }
    set filter(v) {
        this.#filter = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     */
    get limit() {
        return this.#limit
    }
    set limit(v) {
        this.#limit = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     */
    get noiseReduction() {
        return this.#noiseReduction
    }
    set noiseReduction(v) {
        this.#noiseReduction = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     */
    get rawValues() {
        return this.#parser.getValues(this.#fieldInfo.field, this.#limit, this.#filter)
    }

    /**
     *
     * @returns
     */
    getDeltas() {
        const dataPoints = this.rawValues

        // Special case: exactly one point
        if(dataPoints.length == 1) {
            return {deltas: [], zeroDeltaSpan: this.#fieldInfo.expectedMinResolution ?? 1,
                zeroWidthPoints: [{y: dataPoints[0].y, zeroSpan: 1, dataSource: dataPoints[0].dataSource}]}
        }

        // This will be a fraction, so we'll try to get a good decimal
        // representation for sanity's sake.
        const decimalDigits = 10
        const nominalZeroDeltaSpan = this.expectedMinDeltaY / 2
        const headDigits = Math.floor(Math.log10(nominalZeroDeltaSpan))
        const roundTo = Math.pow(10, decimalDigits - headDigits)
        const zeroDeltaSpan = Math.round(nominalZeroDeltaSpan * roundTo) / roundTo

        // Presume sorted in x

        /**
         * @type {{y: number, dF: number, zeroSpan?: undefined}[]}
         */
        const deltas = []
        /**
         * @type {{y: number, zeroSpan: number, dataSource: number}[]}
         */
        const zeroWidthPoints = []
        const dataPoint0 = dataPoints[0]

        // The first point gets injected as if there were an identical point
        // before it (using the _next_ to guess the distance)
        if(dataPoint0.y !== null && dataPoint0.y !== undefined) {
            const dX = dataPoints[1].x - dataPoint0.x // Presumed
            zeroWidthPoints.push({y: dataPoint0.y, zeroSpan: dX, dataSource: dataPoint0.dataSource})
        }

        let lastY = dataPoint0.y ?? 0
        let lastX = dataPoint0.x

        for(let i = 1; i < dataPoints.length; i++) {
            const dataPoint = dataPoints[i]
            if(dataPoint.y === null || dataPoint.y === undefined) {
                continue
            }
            const dX = dataPoint.x - lastX
            if(Math.abs(dataPoint.y - lastY) < zeroDeltaSpan) {
                // Zero point

                if(dataPoint.y === lastY) {
                    // Either is fine
                    zeroWidthPoints.push({y: dataPoint.y, zeroSpan: dX, dataSource: dataPoint.dataSource})
                } else {
                    // We pick one, whichever has the shortest decimal
                    // representation.
                    const shortest = [dataPoint.y, lastY].sort((a, b) => a.toString().length - b.toString().length)[0]
                    zeroWidthPoints.push({y: shortest, zeroSpan: dX, dataSource: dataPoint.dataSource})
                }
            } else {
                // Span point

                /**
                 * @type {number}
                 */
                let lY
                /**
                 * @type {number}
                 */
                let hY
                if(dataPoint.y < lastY) {
                    lY = dataPoint.y
                    hY = lastY
                } else {
                    lY = lastY
                    hY = dataPoint.y
                }
                const dY = hY - lY
                // Push ADD and REMOVE.
                //
                // We consider it to go UP at lY, go down at hY; and we consider
                // the height to be dX / dY.
                //
                // Some explanation needed here: this represents the time at the
                // point value. If the spread of (dY) values is twice as much,
                // the time at any point is half as much. If the spread of time
                // (dX) is twice as much (as would be true if you just added
                // adjacent periods), the time at any point is twie as much.
                // Thus dX / dY.
                //
                // Most of the time here, dX will be 1.
                const h = dX / dY
                deltas.push({y: lY, dF: h})
                deltas.push({y: hY, dF: -h})
            }

            lastY = dataPoint.y
            lastX = dataPoint.x
        }
        deltas.sort((a, b) => a.y - b.y)
        zeroWidthPoints.sort((a, b) => a.y - b.y)

        return {deltas, zeroDeltaSpan, zeroWidthPoints}
    }


    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {boolean} noiseReduction
     * @returns
     */
    getFrequencies(field = this.#fieldInfo.field, noiseReduction = this.#noiseReduction) {
        const dataPoints = this.#parser.getValues(field, this.#limit, this.#filter)

        const expectedMinDeltaY = this.expectedMinDeltaY

        const orderedFrequenciesRealByDS = this.#getOrderedFrequencies(dataPoints)

        /**
         * @type {typeof orderedFrequenciesRealByDS}
         */
        let orderedFrequenciesByDS
        if(noiseReduction) {
            const acceptedValues = this.#getAcceptedValues(orderedFrequenciesRealByDS)

            orderedFrequenciesByDS = Object.fromEntries(Object.entries(orderedFrequenciesRealByDS).map(([ds, frequencies]) => [ds, frequencies.filter(v => acceptedValues[ds]?.has(v.y))]))
        } else {
            orderedFrequenciesByDS = orderedFrequenciesRealByDS
        }

        /**
         * @type {{y: number, f: number}[]}
         */
        const orderedFrequencies = []
        for(const [ds, frequencies] of Object.entries(orderedFrequenciesByDS)) {
            orderedFrequencies.push(...frequencies)
        }
        orderedFrequencies.sort((a, b) => a.y - b.y)

        /**
         * @type {typeof orderedFrequencies}
         */
        const filledFrequencies = []
        for(const [i, frequency] of Object.entries(orderedFrequencies)) {
            filledFrequencies.push(frequency)
            if(!orderedFrequencies[+i+1]) break
            const nextY = orderedFrequencies[+i+1].y
            let thisY = frequency.y
            while(thisY + expectedMinDeltaY < nextY) {
                thisY += expectedMinDeltaY
                filledFrequencies.push({y: thisY, f: 0})
            }
        }

        return filledFrequencies
    }

    /**
     *
     * @param {(EpwNamedField<string> | EpwNamedField<number | null>)[]} fields
     * @returns
     */
    getUniqueValues(fields) {
        const dataPoints = this.#parser.getValueMulti(fields)

        /**
         * @type {Map<number | string, (number | string | null | undefined)[]>}
         */
        const unique = new Map()
        const stringify = (fields.length == 1) ? vs => vs[0] : vs => JSON.stringify(vs)
        for(const dataPoint of dataPoints) {
            const s = stringify(dataPoint)
            if(!unique.has(s)) {
                unique.set(s, dataPoint)
            }
        }
        return [...unique.values()]
    }

    /**
     *
     * @param {EpwParser} parser
     */
    constructor(parser) {
        this.#parser = parser
    }
}