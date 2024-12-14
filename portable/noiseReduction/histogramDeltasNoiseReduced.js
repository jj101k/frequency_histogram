/// <reference path="../histogramDeltasBase.js" />
/// <reference path="dataSourceZeroWidthNeighbours.js" />

/**
 * This is similar but uses a whitelist of sensor points instead.
 */
class HistogramDeltasNoiseReduced extends HistogramDeltasBase {
    /**
     * This is part of the noise reduction system. Values which look like they
     * are not noise are grouped and returned.
     *
     * @param {Record<number, {y: number, f: number}[]>} orderedFrequenciesRealByDS
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
            new InverseLogValueScaler() :
            new InverseValueScaler()
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
            const startScaled = scaler.scale(start.f)
            let lastScaled = 0

            for (const [i, v] of orderedFrequenciesReal.slice(1).entries()) {
                const vScaled = scaler.scale(v.f) - startScaled
                // f0: It's not more than 5x the previous accepted value
                if (vScaled < lastScaled * 5) {
                    lastScaled = vScaled
                    acceptedValues.add(v.y)
                } else {
                    // f1: There are at least 5 values above it
                    const offset = i + 1
                    if(offset + 5 < orderedFrequenciesReal.length) {
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

    /**
     * @type {Record<number, DataSourceZeroWidthNeighbours>}
     */
    #spwStates
    /**
     * This is where a zero-width point could fit. This will decrease in size as
     * points are enumerated.
     *
     * Initially, this is the set of all known points; once a point is certain
     * not to be useful in placing another zero-width point, it gets dropped.
     *
     * Zero-width points would be placed between two of these, typically.
     *
     * NOTE: this is only used if the data source doesn't have enough unique
     * points to be used for that purpose directly.
     */
    #zeroBoundPoints
    /**
     * @type {{y: number, dF: number}[]}
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
     * @param {{y: number, zeroSpan: number, dataSource: number}} zeroPoint
     * @returns
     */
    #getZeroPointEdges(zeroPoint) {
        // We want:
        // 1. The last whitelist point _before_ this
        // 2. The whitelist point on this, if applicable - for next time
        // 3. The whitelist point after this.
        const spwState = this.#spwStates[zeroPoint.dataSource]

        if (!spwState || spwState.nextPoint === null) {
            throw new Error("Internal error")
        }

        if(spwState.nextPoint >= zeroPoint.y && !spwState.points.length) {
            // If we get here, it's a data source which emitted exactly one
            // point, so we can't autodetect the point whitelist. Instead, we
            // presume that it's at the highest possible resolution, with no
            // noise reduction
            // We know that the point list contains this one. We don't know if
            // it contains any others, nor if they are above or below this one.
            if (this.#zeroBoundPoints[0] == zeroPoint.y) {
                if(this.#zeroBoundPoints.length == 1) {
                    console.log(spwState.nextPoint, spwState.points)
                    throw new Error(`Internal error: unable to find a whitelist point before or after ${zeroPoint.y}`)
                }
                // We have a high point only
                return this.extrapolateBefore(zeroPoint.y, this.#zeroBoundPoints[1])
            }
            // Otherwise, we have a low point at least.

            // Wind forward until it's [before, on, after]
            while (this.#zeroBoundPoints[1] < zeroPoint.y) {
                this.#zeroBoundPoints.shift()
            }
            const [lastY, , nextY] = this.#zeroBoundPoints
            return this.extrapolateAfter(lastY, zeroPoint.y, nextY)
        }

        /**
         * @type {number}
         */
        let whitelistPointBefore

        if (spwState.nextPoint < zeroPoint.y) {
            whitelistPointBefore = spwState.nextPoint
        } else {
            // It shouldn't be _after_, so take the next whitelist point and
            // invert it
            whitelistPointBefore = this.beforePoint(zeroPoint.y, spwState.points[0])
        }

        // Suck up until the next point is after.
        while (spwState.points.length && spwState.points[0] <= zeroPoint.y) {
            spwState.getNext()
            if (spwState.nextPoint !== null && spwState.nextPoint < zeroPoint.y) {
                whitelistPointBefore = spwState.nextPoint
            }
        }

        return this.extrapolateAfter(whitelistPointBefore, zeroPoint.y, spwState.points[0])
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
     * @param {Record<number, Set<number>>} sensorPointWhitelist
     */
    constructor(deltaInfo, numberOptions, sensorPointWhitelist) {
        super(deltaInfo, numberOptions)
        this.#spwStates = Object.fromEntries(
            Object.entries(sensorPointWhitelist).map(([ds, whitelist]) => [ds, new DataSourceZeroWidthNeighbours(whitelist)])
        )
        const allPoints = new Set()
        for(const whitelist of Object.values(sensorPointWhitelist)) {
            for(const p of whitelist) {
                allPoints.add(p)
            }
        }
        this.#zeroBoundPoints = [...allPoints].sort((a, b) => a - b)
        console.log("Initial points", sensorPointWhitelist)
    }
}
