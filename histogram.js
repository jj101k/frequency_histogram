/// <reference path="portable/continuousHistogram.js" />
/// <reference path="portable/noiseReduction/continuousHistogramNoiseReduced.js" />
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
     * @param {EpwNamedNumberField} field
     * @param {boolean} noiseReduction
     * @returns
     */
    #getFrequencies(field = this.fieldInfo.field, noiseReduction = this.#noiseReduction) {
        const dataPoints = this.#parser.getValues(field, this.#limit, this.#filter)

        const expectedPrecision = this.expectedPrecision

        const orderedFrequenciesRealByDS = ContinuousHistogram.getOrderedFrequencies(dataPoints)

        /**
         * @type {typeof orderedFrequenciesRealByDS}
         */
        let orderedFrequenciesByDS
        if(noiseReduction) {
            const acceptedValues = HistogramDeltasNoiseReduced.getAcceptedValues(orderedFrequenciesRealByDS, this.fieldInfo.field)

            orderedFrequenciesByDS = HistogramDeltasNoiseReduced.regroupNoiseValues(orderedFrequenciesRealByDS, acceptedValues)
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
            if(frequency.y + expectedPrecision < nextY) {
                // First point: add min delta
                addFrequency({y: frequency.y + expectedPrecision, f: 0})
                // Last point: add _n_ * min delta, where y+n*m < ny
                const pointsToOverlap = Math.floor((nextY - frequency.y) / expectedPrecision - 0.0001)
                addFrequency({y: frequency.y + pointsToOverlap * expectedPrecision, f: 0})
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
     * The expected gap between two adjacent values
     */
    get expectedPrecision() {
        return this.#continuous.expectedPrecision
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
     * The underlying values, where x increases and y is the value to be considered.
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