/// <reference path="../histogramDeltasBase.js" />
/// <reference path="dataSourceZeroWidthNeighbours.js" />
/// <reference path="../types.d.ts" />

/**
 * This is similar to HistogramDeltas but uses a whitelist of sensor points instead.
 *
 * Instead?
 *
 * @see HistogramDeltas
 */
class HistogramDeltasNoiseReduced extends HistogramDeltasBase {
    /**
     * Returns true if the supplied scaled value appears to be noise.
     *
     * @param {ValueFrequencyScaled} v
     * @param {ValueFrequencyScaled} previous
     * @param {ValueFrequencyScaled[]} remaining
     * @returns
     */
    static #looksLikeNoise(v, previous, remaining) {
        // It's < 20% as common as the previous value
        if (v.fScaled * 5 >= previous.fScaled) {
            return false
        }
        // And < 20% as common as the next 10 values (on average)
        const n10mean = remaining.slice(0, 10).reduce(
            (p, c) => ({t: p.t + c.fScaled, c: p.c + 1}), {t: 0, c: 0})
        if(n10mean.c && 5 * v.fScaled >= n10mean.t / n10mean.c) {
            // Note: if it's the last value, it's just accepted.
            return false
        }
        return true
    }

    /**
     * This is part of the noise reduction system. Values which look like they
     * are not noise are grouped and returned.
     *
     * @param {Record<number, ValueFrequency[]>} orderedFrequenciesRealByDS
     * These must be in ascending numeric order
     * @param {valueConfiguration} valueConfig
     * @returns
     */
    static getAcceptedValues(orderedFrequenciesRealByDS, valueConfig) {
        /**
         * Used to determine normal variation between points. For a plain scalar
         * value, this would be fixed, but if it's on an exponential scale (eg.
         * audio volume expressed as literal amplitude instead of decibels), it
         * will depend what the previous point is. There may be other scales in
         * use in future.
         */
        const scaler = valueConfig.expectsExponentialFrequency ?
            new LogValueScaler() :
            new LinearValueScaler()
        /**
         * @type {{[dataSource: number]: Set<number>}} Which values look valid
         * on each data source
         */
        const acceptedValuesByDS = {}
        for(const [ds, orderedFrequenciesReal] of Object.entries(orderedFrequenciesRealByDS)) {
            if(orderedFrequenciesReal.length <= 2) {
                // If a source has 0-1 values, there's nothing to examine.
                // If it has 2 values, there isn't enough to detect a pattern
                // between them.
                acceptedValuesByDS[ds] = new Set(orderedFrequenciesReal.map(f => f.y))
                continue
            }

            /**
             * @type {ValueFrequencyScaled[]}
             */
            const orderedFrequenciesMapped = orderedFrequenciesReal.map(
                v => ({...v, fScaled: scaler.scale(v.f)})
            )

            /**
             * The first value seen is presumed to be non-noise.
             *
             * @todo Adjust this to use a better starting point from early in
             * the set.
             */
            const start = orderedFrequenciesMapped[0]
            orderedFrequenciesMapped.shift()

            /**
             * @type {Set<number>}
             */
            const acceptedValues = new Set([start.y])
            let previous = start

            /**
             * @type {ValueFrequencyScaled | undefined}
             */
            let v

            while((v = orderedFrequenciesMapped.shift())) {
                if(this.#looksLikeNoise(v, previous, orderedFrequenciesMapped)) {
                    console.log(`Dropping value ${v.y} (${v.f}x; from ${previous.y} (${previous.f}x), with [${orderedFrequenciesMapped.length} entries] above)`)
                    continue
                }
                previous = v
                acceptedValues.add(v.y)
            }
            if(acceptedValues.size <= 1) {
                // If all possible further values were rejected, something went wrong.
                console.warn(orderedFrequenciesReal, acceptedValues)
                throw new Error(`Internal error: noise reduction produced ${acceptedValues.size} values from ${orderedFrequenciesReal.length}`)
            }
            acceptedValuesByDS[ds] = acceptedValues
        }

        return acceptedValuesByDS
    }

    /**
     * This reattaches noise values where they should have been originally,
     * where possible.
     *
     * @param {Record<number, ValueFrequency[]>} orderedFrequenciesRealByDS
     * @param {Record<string, Set<number>>} acceptedValuesByDS
     * @returns
     */
    static regroupNoiseValues(orderedFrequenciesRealByDS, acceptedValuesByDS) {
        let regrouped = 0
        /**
         * @type {typeof orderedFrequenciesRealByDS}
         */
        const regroupedValuesByDS = {}
        for(const [source, values] of Object.entries(orderedFrequenciesRealByDS)) {
            /**
             * @type {ValueFrequency | undefined}
             */
            let lastValue
            const acceptedValues = [...acceptedValuesByDS[source]]
            if(acceptedValues.length == 0) {
                console.warn(`No accepted values - all ${values.length} dropped`)
                continue
            }
            // Take the proximity threshold as the average gap between values,
            // which is just (n[max]-n[min])/(sum[n]-1)
            const proximityThreshold = (acceptedValues[acceptedValues.length - 1] - acceptedValues[0]) / (acceptedValues.length - 1)
            /**
             * @type {ValueFrequency[]}
             */
            let missedData = []
            /**
             * @type {ValueFrequency[]}
             */
            const acceptedData = []
            for(const value of values) {
                // Skip past accepted points lower than this one
                while(acceptedValues.length > 0 && acceptedValues[0] < value.y) {
                    acceptedValues.shift()
                }
                // Note: from above, we know that acceptedValues[0] >= value.y
                if(acceptedValues[0] === undefined || acceptedValues[0] > value.y) {
                    missedData.push(value)
                } else {
                    const nextValue = {...value}
                    if(lastValue) {
                        const midPoint = (lastValue.y + nextValue.y) / 2
                        const closeToLast = Math.min(midPoint, lastValue.y + proximityThreshold)
                        const closeToNext = Math.max(nextValue.y - proximityThreshold, midPoint)
                        for(const v of missedData) {
                            if(v.f < closeToLast) {
                                lastValue.f += v.f
                                regrouped++
                            } else if(v.f > closeToNext) {
                                nextValue.f += v.f
                                regrouped++
                            } else {
                                console.warn(`Dropping noise value ${v.y} (${v.f}x)`)
                            }
                        }
                    } else if(missedData.length > 0) {
                        // First time: it's probably accepted, but otherwise
                        // just push it.
                        const closeToNext = nextValue.y - proximityThreshold
                        for(const v of missedData) {
                            if(v.f > closeToNext) {
                                nextValue.f += v.f
                                regrouped++
                            } else {
                                console.warn(`Dropping noise value ${v.y} (${v.f}x)`)
                            }
                        }
                    }
                    acceptedData.push(nextValue) // It may change after this
                    missedData = []
                    lastValue = nextValue
                }
            }

            // Not likely, but there may be some missed data at the end.
            if(missedData.length > 0) {
                if(lastValue) {
                    const closeToLast = lastValue.y + proximityThreshold
                    for(const v of missedData) {
                        if(v.f < closeToLast) {
                            regrouped++
                            lastValue.f += v.f
                        } else {
                            console.warn(`Dropping noise value ${v.y} (${v.f}x)`)
                        }
                    }
                } else {
                    console.warn(`Dropping all ${missedData.length} values`)
                }
            }

            regroupedValuesByDS[source] = acceptedData
        }
        console.log(`${regrouped} noise values regrouped`)
        return regroupedValuesByDS
    }

    /**
     * This is where a zero-width point could fit across all data sources. This
     * will decrease in size as points are enumerated.
     *
     * Initially, this is the set of all known points; once a point is certain
     * not to be useful in placing another zero-width point, it gets dropped.
     *
     * Zero-width points would be placed between two of these, typically.
     *
     * NOTE: this is only used if the data source doesn't have enough unique
     * points to be used for that purpose directly.
     */
    #zeroPointNeighboursAll

    /**
     * @type {Record<number, DataSourceZeroWidthNeighbours>}
     */
    #zeroPointNeighboursBySource

    /**
     * @type {DeltaDatum[]}
     */
    #zeroDeltas = []

    /**
     * Adds two points to zeroDeltas, before and after the current zero point.
     *
     * This will discard the current zero point.
     */
    #addZeroPointFull() {
        const zeroPoint = this.nextZeroPoint
        if (!zeroPoint) {
            throw new Error("Internal error")
        }
        const { lastY, nextY } = this.#getZeroPointEdges(zeroPoint)

        // Assume that it's oscillating just enough to not be detected (ie, +/-
        // half the minimum distance). This "flattens" the infinitely high point
        // into a
        const [lowZeroPoint, highZeroPoint] = [
            { y: (lastY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (nextY - lastY) },
            { y: (nextY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (nextY - lastY) },
        ]
        // Now we have the answer we can push the values
        this.#zeroDeltas.push(lowZeroPoint, highZeroPoint)
        this.getNextZeroPoint()
    }

    /**
     * This produces a small span for a zero-width point, so that it is not
     * infinitely high.
     *
     * This inspects the whitelist points for the data source, and will actively
     * clean up any which can no longer be used.
     *
     * If accepted values are always `n` apart and the value is `v`, this will
     * return something close to `v-n, v+n`
     *
     * @param {ZeroWidthPoint} zeroPoint
     * @returns
     */
    #getZeroPointEdges(zeroPoint) {
        // We want:
        // 1. The last whitelist point _before_ this
        // 2. The whitelist point on this, if applicable - for next time
        // 3. The whitelist point after this.
        let zeroPointNeighbours = this.#zeroPointNeighboursBySource[zeroPoint.dataSource]

        if (!zeroPointNeighbours) {
            throw new Error("Internal error: source is not known")
        }

        if(zeroPointNeighbours.nextPoint >= zeroPoint.y && !zeroPointNeighbours.points.length) {
            // If we get here, there's only one point left (after the current
            // zero point), so we can't pick out neighbours. This should only
            // happen with data sources which only have one point.
            //
            // There may still be points in the general list, and if so we'll
            // use them.
            zeroPointNeighbours = this.#zeroPointNeighboursAll
        }

        /**
         * A point which is before the current point and (where possible) is in
         * the whitelist.
         */
        let whitelistPointBefore = zeroPointNeighbours.getLastPointBefore(zeroPoint.y)
        if(whitelistPointBefore === null) {
            if(zeroPointNeighbours.nextPoint > zeroPoint.y) {
                throw new Error(`Internal error: no points were found before ${zeroPoint.y} [${zeroPointNeighbours.debugMin}..${zeroPointNeighbours.debugMax}]`)
            }
            // This can legitimately happen if a zero point is also the lowest
            // point in the accepted set. Where that's true, we make one up
            // that's earlier.

            /**
             * @todo improve this to assume that the lower bound is genuinely
             * the lower bound.
             */
            whitelistPointBefore = this.beforePoint(zeroPoint.y, zeroPointNeighbours.higherPoint)
        }

        /**
         * @todo improve this to properly respect the upper bound
         */
        return this.extrapolateAfter(whitelistPointBefore, zeroPoint.y, zeroPointNeighbours.possibleHigherPoint)
    }

    buildCombined() {
        // We do _two_ passes here:
        // One for the zero points -> temp
        while (this.nextZeroPoint) {
            this.#addZeroPointFull()
        }

        this.#zeroDeltas.sort((a, b) => a.y - b.y)

        // Then one for the nonzero points + <- temp
        while (this.nextSpanPoint) {
            const nsp = this.nextSpanPoint
            const i = this.#zeroDeltas.findIndex(d => d.y > nsp.y)
            if (i < 0) {
                // This means all remaining zero deltas are <= nsp.y
                this.addDeltas(...this.#zeroDeltas)
                this.#zeroDeltas = []
            } else {
                this.addDeltas(...this.#zeroDeltas.slice(0, i))
                this.#zeroDeltas = this.#zeroDeltas.slice(i)
            }
            this.addNextSpanPoint()
        }
    }

    /**
     *
     * @param {DeltaInfo} deltaInfo
     * @param {{maximum?: number, minimum?: number} | undefined} numberOptions
     * @param {Record<number, Set<number>>} valueWhitelistBySource
     */
    constructor(deltaInfo, numberOptions, valueWhitelistBySource) {
        super(deltaInfo, numberOptions)
        /**
         * @type {Record<number, DataSourceZeroWidthNeighbours>}
         */
        const zeroPointNeighboursBySource = {}
        const allPoints = new Set()
        for(const [ds, whitelist] of Object.entries(valueWhitelistBySource)) {
            for(const p of whitelist) {
                allPoints.add(p)
            }
            zeroPointNeighboursBySource[+ds] = new DataSourceZeroWidthNeighbours(whitelist)
        }
        this.#zeroPointNeighboursBySource = zeroPointNeighboursBySource
        this.#zeroPointNeighboursAll = new DataSourceZeroWidthNeighbours([...allPoints].sort((a, b) => a - b))
        console.log("Initial points", valueWhitelistBySource)
    }
}
