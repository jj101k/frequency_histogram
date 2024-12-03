//@ts-check
/// <reference path="histogramDeltasNoiseReduced.js" />
/// <reference path="../continuousHistogram.js" />
/// <reference path="../positionScaler.js" />
/// <reference path="../types.d.ts" />

/**
 * Handles functionality related specifically to continuous histograms
 */
class ContinuousHistogramNoiseReduced extends ContinuousHistogram {
    /**
     * This is part of the noise reduction system. Values which look like they
     * are not noise are grouped and returned.
     *
     * @param {Record<number, {y: number, f: number}[]>} orderedFrequenciesRealByDS
     * @returns
     */
    #getAcceptedValues(orderedFrequenciesRealByDS) {
        const scaler = new FrequencyPositionScaler(this.fieldInfo.field)
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
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        const orderedFrequencies = ContinuousHistogram.getOrderedFrequencies(this.rawValues)
        if(orderedFrequencies && Object.keys(orderedFrequencies).length > 1) {
            const deltaInfo = this.deltaInfo
            return new HistogramDeltasNoiseReduced(deltaInfo, this.bounds, this.#getAcceptedValues(orderedFrequencies)).combined
        } else {
            return super.combined
        }
    }
}