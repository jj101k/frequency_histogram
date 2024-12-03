//@ts-check
/// <reference path="histogramDeltasNoiseReduced.js" />
/// <reference path="../continuousHistogram.js" />
/// <reference path="../positionScaler.js" />
/// <reference path="../types.d.ts" />

/**
 * Handles functionality related specifically to continuous histograms, with
 * noise reduction on the data source(s).
 *
 * Note: data sets which contain exactly one unique value cannot be
 * noise-reduced, and ones with two cannot be meaningfully noise-reduced.
 */
class ContinuousHistogramNoiseReduced extends ContinuousHistogram {
    /**
     * This is part of the noise reduction system. Values which look like they
     * are not noise are grouped and returned.
     *
     * @param {Record<number, {y: number, f: number}[]>} orderedFrequenciesRealByDS
     * These must be in descending numeric order
     * @returns
     */
    #getAcceptedValues(orderedFrequenciesRealByDS) {
        /**
         * Used to determine normal variation between points. For a plain scalar
         * value, this would be fixed, but if it's on an exponential scale (eg.
         * audio volume expressed as literal amplitude instead of decibels), it
         * will depend what the previous point is. There may be other scales in
         * use in future.
         */
        const scaler = new FrequencyPositionScaler(this.fieldInfo.field)
        /**
         * @type {{[dataSource: number]: Set<number>}} Which values look valid
         * on each data source
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
            /**
             * The first value seen is presumed to be non-noise.
             *
             * @todo Adjust this to use a better starting point from early in
             * the set.
             */
            const start = orderedFrequenciesReal[0]
            acceptedValues.add(start.y)
            let lastScaled = scaler.displayY(start)

            for (const [i, v] of orderedFrequenciesReal.slice(1).entries()) {
                // Note these values are flipped
                const vScaled = scaler.displayY(v)
                // f0: It's >20% of the previous accepted value
                if (vScaled > lastScaled * 0.20) {
                    lastScaled = vScaled
                    acceptedValues.add(v.y)
                } else {
                    // f1: It's >20% of the mean of the next 10 pending
                    // values
                    const n10mean = orderedFrequenciesReal.slice(i + 1, i + 1 + 10).reduce(
                        (p, c) => ({t: p.t + scaler.displayY(c), c: p.c + 1}), {t: 0, c: 0})
                    if(n10mean.c && 5 * vScaled < n10mean.t / n10mean.c) {
                        lastScaled = vScaled
                        acceptedValues.add(v.y)
                    }
                }
            }
            if(acceptedValues.size < 2) {
                console.warn(orderedFrequenciesReal, acceptedValues)
                throw new Error(`Internal error: noise reduction produced ${acceptedValues.size} values from ${orderedFrequenciesReal.length}`)
            }
            acceptedValuesByDS[ds] = acceptedValues
        }

        return acceptedValuesByDS
    }
    get combined() {
        const orderedFrequencies = ContinuousHistogram.getOrderedFrequencies(this.rawValues)
        // We go into noise reduction if we can.
        if(orderedFrequencies && Object.keys(orderedFrequencies).length > 1) {
            const deltaInfo = this.deltaInfo
            return new HistogramDeltasNoiseReduced(deltaInfo, this.bounds, this.#getAcceptedValues(orderedFrequencies)).combined
        } else {
            return super.combined
        }
    }
}