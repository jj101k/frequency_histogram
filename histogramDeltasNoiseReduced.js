//@ts-check
/// <reference path="histogramDeltasAny.js" />
/// <reference path="sensorWhitelistState.js" />

/**
 * This is similar but uses a whitelist of sensor points instead.
 */
class HistogramDeltasNoiseReduced extends HistogramDeltasAny {
    /**
     * @type {Record<number, SensorWhitelistState>}
     */
    #spwStates
    /**
     * This is where a zero-width point could fit. This will decrease in size as
     * points are enumerated.
     */
    #zeroBoundPoints
    /**
     * @type {{y: number, dF: number}[]}
     */
    #zeroDeltas = []

    /**
     *
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
     * @param {numberOptions | undefined} numberOptions
     * @param {Record<number, Set<number>>} sensorPointWhitelist
     */
    constructor(deltaInfo, numberOptions, sensorPointWhitelist) {
        super(deltaInfo, numberOptions)
        this.#spwStates = Object.fromEntries(
            Object.entries(sensorPointWhitelist).map(([ds, whitelist]) => [ds, new SensorWhitelistState(whitelist)])
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
