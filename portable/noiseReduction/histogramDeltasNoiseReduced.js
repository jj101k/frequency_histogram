/// <reference path="../histogramDeltasBase.js" />
/// <reference path="../types.d.ts" />

/**
 * This is similar to HistogramDeltas but uses a whitelist of sensor points to
 * more accurately detect zero-delta edges.
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
     * This deals with data which is at a fixed precision ("rounded to the
     * nearest <x>") but isn't always accurately represented, and emits what
     * those fixed precision points should have been for the data.
     *
     * This is designed specifically for mixes of data where different sources
     * may have been rounding to different unit boundaries, eg. you might get 1,
     * 2, 2.54, 3, 4, 5, 5.08, 6 if you mix inches and centimetres. The most
     * widely used points in the data set will be retained.
     *
     * @param {Record<number, ValueFrequency[]>} orderedFrequenciesRealByDS
     * These must be in ascending numeric order
     * @param {valueConfiguration} valueConfig
     * @returns The fixed precision points for each source
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
         * @type {{previous: ValueFrequency, dropped: ValueFrequency}[]}
         */
        const dropped = []
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
                    dropped.push({previous, dropped: v})
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
        if(dropped.length) {
            console.debug(dropped)
        }

        return acceptedValuesByDS
    }

    /**
     *
     * @param {Record<string, Set<number>>} acceptedValuesByDS
     * @returns
     */
    static aggregateAcceptedValues(acceptedValuesByDS) {
        /**
         * @type {Record<number, number>}
         */
        const seenValues = {}
        for(const [source, values] of Object.entries(acceptedValuesByDS)) {
            for(const value of values) {
                if(!seenValues[value]) {
                    seenValues[value] = 0
                }
                seenValues[value]++
            }
        }
        // Find the sources which have the most points in common
        const sourceScores = Object.entries(acceptedValuesByDS).map(
            ([source, values]) => ({source, score: [...values].reduce((c, v) => c + seenValues[v], 0)}))
        sourceScores.sort((a, b) => b.score - a.score) // Highest score first

        const precision = this.getPrecision(acceptedValuesByDS[sourceScores[0].source])

        // Start at the most popular point, and then go down in popularity,
        // eliminating points within `distance` of any existing point
        const points = Object.entries(seenValues).sort(([va, pa], [vb, pb]) => pb - pa).map(([v]) => +v)
        const mostPopularPoint = points[0]
        const acceptedPoints = [mostPopularPoint]
        for(const point of points.slice(1)) {
            const position = this.#binarySearchPoint(acceptedPoints, (a, b) => a - b, point)
            if(position == -1) {
                if(acceptedPoints[0] - point >= precision) {
                    acceptedPoints.splice(position + 1, 0, point)
                }
            } else if(position == acceptedPoints.length - 1) {
                if(point - acceptedPoints[acceptedPoints.length - 1] >= precision) {
                    acceptedPoints.push(point)
                }
            } else {
                // Mid-point. The one at `position` is before, and `position+1`
                // is after.
                const before = acceptedPoints[position]
                const after = acceptedPoints[position + 1]
                if(after - point >= precision && point - before >= precision) {
                    acceptedPoints.splice(position + 1, 0, point)
                }
            }
        }
        console.log(precision, acceptedPoints)
        return acceptedPoints
    }

    /**
     *
     * @template T
     * @param {T[]} list
     * @param {(a: T, b: T) => number} sort
     * @param {T} value
     * @returns {number} The position after which this value could fit.
     */
    static #binarySearchPoint(list, sort, value) {
        let lowerBound = -1
        let upperBound = list.length - 1
        // Validate the bounds
        if(sort(value, list[upperBound]) > 0) {
            return upperBound
        }
        while(upperBound > lowerBound + 1) {
            const checkPoint = Math.round((lowerBound + upperBound) / 2)
            const compare = list[checkPoint]
            const result = sort(value, compare) // Based on normal a-b, -1 means that value is lower
            if(result > 0) {
                // value is higher
                lowerBound = checkPoint
            } else {
                // it's lower (or perhaps equal)
                upperBound = checkPoint
            }
        }
        return lowerBound
    }

    /**
     * For the supplied set of possible values, returns the median difference,
     * ie. the expected precision of the values.
     *
     * @param {Iterable<number>} topSourceIn
     * @returns
     */
    static getPrecision(topSourceIn) {
        const topSource = [...topSourceIn].sort((a, b) => a - b)
        let lastPoint = topSource[0]
        const diffs = topSource.slice(1).map(v => { const result = v - lastPoint; lastPoint = v; return result })
        diffs.sort((a, b) => a - b)
        /**
         * @type {number}
         */
        let precision
        const midPoint = (diffs.length - 1) / 2
        if (midPoint % 1 == 0) {
            // If it's an odd number, we take the one in the middle.
            precision = diffs[midPoint]
        } else {
            // If it's even, we average the two in the middle
            precision = (diffs[Math.floor(midPoint)] + diffs[Math.floor(midPoint) + 1]) / 2
        }

        const inRange = diffs.reduce((c, d) => d <= precision ? c + 1 : c, 0)
        console.debug(`${inRange} of ${diffs.length} gaps are within the expected range`)
        return precision
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
        const x = this.aggregateAcceptedValues(acceptedValuesByDS)
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
            // const acceptedValues = [...acceptedValuesByDS[source]]
            const acceptedValues = [...x]
            if(acceptedValues.length == 0) {
                console.warn(`No accepted values - all ${values.length} dropped`)
                continue
            }
            // Take the proximity threshold as the mean gap between values,
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
            /**
             * @type {number | undefined}
             */
            let previousAcceptedPoint
            for(const value of values) {
                // Skip past accepted points lower than this one
                while(acceptedValues.length > 0 && acceptedValues[0] < value.y) {
                    previousAcceptedPoint = acceptedValues[0]
                    acceptedValues.shift()
                }

                // Note: from above, we know that acceptedValues[0] >= value.y
                if(acceptedValues[0] === undefined || acceptedValues[0] > value.y) {
                    missedData.push(value)
                } else {
                    const nextValue = {...value}
                    if(previousAcceptedPoint !== undefined) {
                        /**
                         * @type {ValueFrequency}
                         */
                        let lowValue
                        if(lastValue && previousAcceptedPoint == lastValue.y) {
                            lowValue = lastValue
                        } else {
                            // Push it.
                            lowValue = {y: previousAcceptedPoint, f: 0}
                            acceptedData.push(lowValue)
                        }
                        const midPoint = (lowValue.y + nextValue.y) / 2
                        const closeToLast = Math.min(midPoint, lowValue.y + proximityThreshold)
                        const closeToNext = Math.max(nextValue.y - proximityThreshold, midPoint)
                        let droppedValues = 0
                        for(const v of missedData) {
                            if(v.f < closeToLast) {
                                lowValue.f += v.f
                                regrouped++
                            } else if(v.f > closeToNext) {
                                nextValue.f += v.f
                                regrouped++
                            } else {
                                droppedValues += v.f
                                regrouped++
                                console.warn(`Moving noise value ${v.y} (${v.f}x) to [${lastValue.y}] ${midPoint} [${nextValue.y}]`)
                            }
                        }
                        if(droppedValues != 0) {
                            missedData = []
                            const midValue = {y: midPoint, f: droppedValues}
                            acceptedData.push(nextValue, midValue) // It may change after this
                            lastValue = midValue
                            continue
                        }
                    } else if(missedData.length > 0) {
                        // First time: it's probably accepted, but otherwise
                        // just push it.
                        const closeToNext = nextValue.y - proximityThreshold
                        let droppedValues = 0
                        for(const v of missedData) {
                            if(v.f > closeToNext) {
                                nextValue.f += v.f
                                regrouped++
                            } else {
                                droppedValues += v.f
                                regrouped++
                                console.warn(`Moving noise value ${v.y} (${v.f}x) up to ${closeToNext} [${nextValue.y}]`)
                            }
                        }
                        if(droppedValues != 0) {
                            missedData = []
                            const midValue = {y: closeToNext, f: droppedValues}
                            acceptedData.push(midValue, nextValue) // It may change after this
                            lastValue = midValue
                            continue
                        }
                    }
                    acceptedData.push(nextValue) // It may change after this
                    missedData = []
                    lastValue = nextValue
                }
            }

            // Not likely, but there may be some missed data at the end.
            if(missedData.length > 0) {
                if(previousAcceptedPoint !== undefined) {
                    /**
                     * @type {ValueFrequency}
                     */
                    let lowValue
                    if(lastValue && previousAcceptedPoint == lastValue.y) {
                        lowValue = lastValue
                    } else {
                        // Push it.
                        lowValue = {y: previousAcceptedPoint, f: 0}
                        acceptedData.push(lowValue)
                    }
                    let droppedValues = 0
                    const closeToLast = lowValue.y + proximityThreshold
                    for(const v of missedData) {
                        if(v.f < closeToLast) {
                            regrouped++
                            lowValue.f += v.f
                        } else {
                            console.warn(`Moving noise value ${v.y} (${v.f}x) down to [${lowValue.y}] ${closeToLast}`)
                        }
                    }
                    if(droppedValues != 0) {
                        acceptedData.push({y: closeToLast, f: droppedValues})
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
     * @type {Record<number, number>}
     */
    #sourcePrecision

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
        const precision = this.#sourcePrecision[zeroPoint.dataSource]
        if(!precision) {
            throw new Error("Internal error: source is not known")
        }
        return {lastY: zeroPoint.y - precision, nextY: zeroPoint.y + precision}
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
        this.#sourcePrecision = Object.fromEntries(Object.entries(valueWhitelistBySource).map(
            ([ds, whitelist]) => [ds, HistogramDeltasNoiseReduced.getPrecision(whitelist)]
        ))
    }
}
