/// <reference path="histogramDeltas.js" />
/// <reference path="types.d.ts" />

/**
 * Handles functionality related specifically to continuous histograms.
 */
class ContinuousHistogram {
    /**
     *
     * @param {Iterable<InputDatum>} dataPoints
     * @returns
     */
    static getOrderedFrequencies(dataPoints) {
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
        /**
         * @type {Record<number, ValueFrequency[]>}
         */
        const orderedFrequenciesReal = Object.fromEntries(
            Object.entries(frequenciesByDS).map(([i, frequencies]) => [i,
                Object.entries(frequencies).map(([y, f]) => ({ y: +y, f })).sort((a, b) => a.y - b.y)])
        )
        return orderedFrequenciesReal
    }
    /**
     * @type {DeltaInfo | undefined}
     */
    #deltaInfo

    /**
     * @see expectedPrecision
     */
    #expectedPrecisionCache

    /**
     * @type {{field: valueConfiguration, expectedMinResolution?: number | undefined}}
     */
    #fieldInfo

    /**
     *
     */
    #length

    /**
     *
     */
    #values

    /**
     *
     * @returns {DeltaInfo}
     */
    #getDeltas() {
        const dataPoints = this.rawValues

        // Special case: exactly one point
        if(this.#length == 1) {
            const [dataPoint0] = dataPoints
            return {deltas: [], precision: this.#expectedPrecisionCache ?? 1,
                zeroWidthPoints: [{y: dataPoint0.y, zeroSpan: 1, dataSource: dataPoint0.dataSource}]}
        }

        // This will be a fraction, so we'll try to get a good decimal
        // representation for sanity's sake.

        /**
         * The distance past one value where it would be rounded to the next (raw)
         */
        const halfPrecisionRaw = this.expectedPrecision / 2
        /**
         * The maximum length of value we'll tolerate.
         */
        const decimalDigits = 10
        /**
         * Eg. if halfPrecisionRaw is 0.25, this will be -1; or if it's 25,
         * it'll be 1. This just answers where the leading digit of the value is.
         */
        const headDigits = Math.floor(Math.log10(halfPrecisionRaw))
        /**
         * The inverse of the intended rounding accuracy (to avoid division)
         */
        const invRoundTo = Math.pow(10, decimalDigits - headDigits)
        /**
         * The distance past one value where it would be rounded to the next.
         * This should have no more than `decimalDigits` digits.
         */
        const halfPrecision = Math.round(halfPrecisionRaw * invRoundTo) / invRoundTo

        // Presume sorted in x

        /**
         * @type {DeltaDatum[]}
         */
        const deltas = []
        /**
         * @type {ZeroWidthPoint[]}
         */
        const zeroWidthPoints = []

        /**
         * @type {{x: number, y: number} | undefined}
         */
        let last
        for(const dataPoint of dataPoints) {
            if(!last) {
                // The first point gets injected as if there were an identical point
                // before it (using the _next_ to guess the distance)
                if(dataPoint.y !== null && dataPoint.y !== undefined) {
                    const dX = dataPoints[1].x - dataPoint.x // Presumed
                    zeroWidthPoints.push({y: dataPoint.y, zeroSpan: dX, dataSource: dataPoint.dataSource})
                }

                last = {x: dataPoint.x, y: dataPoint.y ?? 0}

                continue
            }

            if(dataPoint.y === null || dataPoint.y === undefined) {
                continue
            }
            const dX = dataPoint.x - last.x
            if(Math.abs(dataPoint.y - last.y) < halfPrecision) {
                // Zero point

                if(dataPoint.y === last.y) {
                    // Either is fine
                    zeroWidthPoints.push({y: dataPoint.y, zeroSpan: dX, dataSource: dataPoint.dataSource})
                } else {
                    // We pick one, whichever has the shortest decimal
                    // representation.
                    const shortest = [dataPoint.y, last.y].sort((a, b) => a.toString().length - b.toString().length)[0]
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
                if(dataPoint.y < last.y) {
                    lY = dataPoint.y
                    hY = last.y
                } else {
                    lY = last.y
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

            last = dataPoint
        }
        deltas.sort((a, b) => a.y - b.y)
        zeroWidthPoints.sort((a, b) => a.y - b.y)

        return {deltas, precision: halfPrecision * 2, zeroWidthPoints}
    }

    /**
     * @protected
     */
    bounds

    /**
     * @protected
     */
    get deltaInfo() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.#getDeltas()
        }
        return this.#deltaInfo
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        return new HistogramDeltas(this.deltaInfo, this.bounds).combined
    }

    /**
     *
     */
    get cumulativeDeltas() {
        /**
         * @type {{y: number, f: number}[]}
         */
        const cumulativeDeltas = []
        const combinedDeltas = this.combined
        if(combinedDeltas.length) {
            let f = 0
            for(const d of combinedDeltas) {
                f += d.dF
                cumulativeDeltas.push({y: d.y, f})
            }
        }

        return cumulativeDeltas
    }

    /**
     * How much difference there is between adjacent values
     */
    get expectedPrecision() {
        let expectedPrecision = this.#expectedPrecisionCache
        if(expectedPrecision === undefined) {
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

                expectedPrecision = realMinDeltaY
            } else {
                console.warn("Not enough distinct values for a delta calculation, will use 1")
                expectedPrecision = 1
            }
        }

        return expectedPrecision
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
    }

    /**
     *
     */
    get rawValues() {
        return this.#values
    }

    /**
     *
     * @param {Iterable<InputDatum>} values The underlying values, where x
     * increases and y is the value to be considered. This will assume that x
     * values are always the same distance apart.
     * @param {number} length
     * @param {{maximum?: number, minimum?: number}} [bounds] Used to ensure that
     * out-of-range points aren't emitted
     * @param {number} [expectedPrecision] How much difference is expected
     * between adjacent values, if known.
     */
    constructor(values, length, bounds, expectedPrecision) {
        this.#values = values
        this.#length = length
        this.bounds = bounds
        this.#expectedPrecisionCache = expectedPrecision
    }
}