//@ts-check
/// <reference path="portable/continuousHistogram.js" />
/// <reference path="portable/noiseReduction/continuousHistogramNoiseReduced.js" />
/// <reference path="portable/noiseReduction/histogramDeltasNoiseReduced.js" />
/// <reference path="portable/positionScaler.js" />
/// <reference path="epwDataFormat.js" />
/// <reference path="epwParser.js" />
/// <reference path="portable/types.d.ts" />

/**
 *
 */
class Histogram {
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
    get #continuous() {
        const numberOptions = (this.#fieldInfo.field instanceof EpwNamedConstrainedNumberField) ? this.#fieldInfo.field.options : undefined
        const continuous = this.#noiseReduction ?
            new ContinuousHistogramNoiseReduced(this.rawValues, this.rawValues.length, numberOptions, this.#fieldInfo.expectedMinResolution) :
            new ContinuousHistogram(this.rawValues, this.rawValues.length, numberOptions, this.#fieldInfo.expectedMinResolution)
        continuous.fieldInfo = this.#fieldInfo
        return continuous
    }

    /**
     *
     * @param {Record<number, {y: number, f: number}[]>} orderedFrequenciesRealByDS
     * @returns
     */
    #getAcceptedValues(orderedFrequenciesRealByDS) {
        const scaler = new FrequencyPositionScaler(this.#fieldInfo.field)
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
     * @param {EpwNamedNumberField} field
     * @param {boolean} noiseReduction
     * @returns
     */
    #getFrequencies(field = this.fieldInfo.field, noiseReduction = this.#noiseReduction) {
        const dataPoints = this.#parser.getValues(field, this.#limit, this.#filter)

        const expectedMinDeltaY = this.expectedMinDeltaY

        const orderedFrequenciesRealByDS = ContinuousHistogram.getOrderedFrequencies(dataPoints)

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

        console.log(`${orderedFrequencies.length} ordered frequencies found`)

        /**
         * @type {typeof orderedFrequencies}
         */
        const filledFrequencies = []
        let l = 0
        /**
         *
         * @param {typeof orderedFrequencies[0]} f
         */
        const addFrequency = (f) => {
            l++
            if(l >= 1_000_000) {
                throw new Error(`Too many data points to use (${l}+)`)
            }
            filledFrequencies.push(f)
        }
        for(const [i, frequency] of Object.entries(orderedFrequencies)) {
            addFrequency(frequency)
            if(!orderedFrequencies[+i+1]) break
            const nextY = orderedFrequencies[+i+1].y
            if(frequency.y + expectedMinDeltaY < nextY) {
                // First point: add min delta
                addFrequency({y: frequency.y + expectedMinDeltaY, f: 0})
                // Last point: add _n_ * min delta, where y+n*m < ny
                const pointsToOverlap = Math.floor((nextY - frequency.y) / expectedMinDeltaY - 0.0001)
                addFrequency({y: frequency.y + pointsToOverlap * expectedMinDeltaY, f: 0})
            }
        }

        console.log(`${filledFrequencies.length} frequencies emitted`)

        return filledFrequencies
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        return this.#continuous.combined
    }

    /**
     *
     */
    get cumulativeDeltas() {
        return this.#continuous.cumulativeDeltas
    }

    /**
     *
     */
    get expectedMinDeltaY() {
        return this.#continuous.expectedMinDeltaY
    }

    /**
     *
     */
    get fieldInfo() {
        return this.#fieldInfo
    }
    set fieldInfo(v) {
        this.#fieldInfo = v
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
        this.#frequencies = undefined
    }

    get frequencies() {
        if(!this.#frequencies) {
            this.#frequencies = this.#getFrequencies()
        }
        return this.#frequencies.slice()
    }

    /**
     *
     */
    get limit() {
        return this.#limit
    }
    set limit(v) {
        this.#limit = v
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
        this.#frequencies = undefined
    }

    /**
     *
     */
    get rawValues() {
        return this.#parser.getValues(this.fieldInfo.field, this.#limit, this.#filter)
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