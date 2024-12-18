/// <reference path="histogramDeltasNoiseReduced.js" />
/// <reference path="../continuousHistogram.js" />
/// <reference path="../types.d.ts" />

/**
 * Handles functionality related specifically to continuous histograms, with
 * noise reduction on the data source(s). At the current time, this only affects
 * how the effective span of zero-delta points is calculated.
 *
 * @see Histogram which directly uses noise-reduced data for the non-continuous view
 *
 * Note: data sets which contain exactly one unique value cannot be
 * noise-reduced, and ones with two cannot be meaningfully noise-reduced.
 */
class ContinuousHistogramNoiseReduced extends ContinuousHistogram {
    get combined() {
        const orderedFrequencies = ContinuousHistogram.getOrderedFrequencies(this.rawValues)
        // We go into noise reduction if we can.
        if(orderedFrequencies && Object.keys(orderedFrequencies).length > 1) {
            const deltaInfo = this.deltaInfo
            return new HistogramDeltasNoiseReduced(deltaInfo, this.bounds,
                HistogramDeltasNoiseReduced.getAcceptedValues(orderedFrequencies, this.fieldInfo.field)).combined
        } else {
            return super.combined
        }
    }
}