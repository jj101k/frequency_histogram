//@ts-check
/// <reference path="sensorWhitelistState.js" />

/**
 * This is similar but uses a whitelist of sensor points instead.
 */
class HistogramDeltasNoiseReduced {
    /**
     *
     */
    #ap
    /**
     * @type {{y: number, dF: number}[]}
     */
    #combinedDeltas = [];
    /**
     * @type {{y: number, dF: number} | null}
     */
    #nextSpanPoint = null;
    /**
     * @type {{y: number, zeroSpan: number, dataSource: number} | null}
     */
    #nextZeroPoint = null;

    /**
     *
     */
    #pointsAround
    /**
     * @type {Record<number, SensorWhitelistState>}
     */
    #spwStates
    /**
     *
     */
    #spanPoints
    /**
     * @type {{y: number, dF: number}[]}
     */
    #zeroDeltas = [];
    /**
     *
     */
    #zeroDeltaSpan
    /**
     *
     */
    #zeroWidthPoints

    /**
     *
     * @param {{y: number, dF: number}[]} values
     */
    #addDeltas(...values) {
        if (!values.length) {
            return 0
        }
        let vL = this.#combinedDeltas[this.#combinedDeltas.length - 1]
        let added = 0
        if (!vL) {
            vL = values[0]
            values.shift()
            this.#combinedDeltas.push(vL)
            added++
        }
        for (const v of values) {
            if (v.y == vL.y) {
                vL.dF += v.dF
            } else {
                this.#combinedDeltas.push(v)
                added++
                vL = v
            }
        }
        return added
    }

    /**
     *
     */
    #addNextSpanPoint() {
        if (this.#nextSpanPoint) {
            this.#addDeltas(this.#nextSpanPoint)
            this.#getNextSpanPoint()
        }
    }

    /**
     *
     */
    #addZeroPointFull() {
        const zeroPoint = this.#nextZeroPoint
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
        this.#getNextZeroPoint()
    }

    /**
     *
     */
    #getNextSpanPoint() {
        this.#nextSpanPoint = this.#shiftSpanPoints()
    }

    /**
     *
     */
    #getNextZeroPoint() {
        this.#nextZeroPoint = this.#shiftZeroPoints()
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
            if (this.#ap[0] == zeroPoint.y) {
                if(this.#ap.length == 1) {
                    console.log(spwState.nextPoint, spwState.points)
                    throw new Error(`Internal error: unable to find a whitelist point before or after ${zeroPoint.y}`)
                }
                // We have a high point only
                return {lastY: zeroPoint.y - (this.#ap[0] - zeroPoint.y), nextY: this.#ap[0]}
            }
            // Otherwise, we have a low point at least.
            while (this.#ap[1] < zeroPoint.y) {
                this.#ap.shift()
            }
            const lastY = this.#ap[0]
            if(this.#ap.length >= 3) {
                return {lastY, nextY: this.#ap[2]}
            } else {
                return {lastY, nextY: zeroPoint.y + (zeroPoint.y - lastY)}
            }
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
            whitelistPointBefore = zeroPoint.y - (spwState.points[0] - zeroPoint.y)
        }

        // Suck up until the next point is after.
        while (spwState.points.length && spwState.points[0] <= zeroPoint.y) {
            spwState.getNext()
            if (spwState.nextPoint !== null && spwState.nextPoint < zeroPoint.y) {
                whitelistPointBefore = spwState.nextPoint
            }
        }

        const lastY = whitelistPointBefore
        const nextY = spwState.points.length ? spwState.points[0] : (zeroPoint.y + (zeroPoint.y - lastY))
        return { lastY, nextY }
    }

    /**
     *
     * @returns
     */
    #shiftSpanPoints() {
        const v0 = this.#spanPoints.shift()
        if (!v0) {
            return null
        }
        const out = { ...v0 }
        while (this.#spanPoints.length && this.#spanPoints[0].y == v0.y) {
            out.dF += this.#spanPoints[0].dF
            this.#spanPoints.shift()
        }
        return out
    }

    /**
     *
     * @returns
     */
    #shiftZeroPoints() {
        const v0 = this.#zeroWidthPoints.shift()
        if (!v0) {
            return null
        }
        const out = { ...v0 }
        while (this.#zeroWidthPoints.length && this.#zeroWidthPoints[0].y == v0.y) {
            out.zeroSpan += this.#zeroWidthPoints[0].zeroSpan
            this.#zeroWidthPoints.shift()
        }
        return out
    }

    /**
     *
     * @param {{y: number, dF: number}[]} deltas
     * @param {number} zeroDeltaSpan
     * @param {{y: number, zeroSpan: number, dataSource: number}[]} zeroWidthPoints
     * @param {Record<number, Set<number>>} sensorPointWhitelist
     */
    constructor(deltas, zeroDeltaSpan, zeroWidthPoints, sensorPointWhitelist) {
        this.#spanPoints = deltas
        this.#zeroDeltaSpan = zeroDeltaSpan
        this.#zeroWidthPoints = zeroWidthPoints
        this.#spwStates = Object.fromEntries(
            Object.entries(sensorPointWhitelist).map(([ds, whitelist]) => [ds, new SensorWhitelistState(whitelist)])
        )
        /**
         * @type {Set<number>}
         */
        const needPointsAround = new Set()
        // If there are any data sources with <2 points, we need a fallback.
        for(const [ds, wls] of Object.entries(this.#spwStates)) {
            if(wls.points.length) {
                continue
            }
            if(wls.nextPoint === null) {
                continue
            }
            needPointsAround.add(wls.nextPoint)
        }

        const allPoints = new Set()
        for(const [ds, whitelist] of Object.entries(sensorPointWhitelist)) {
            for(const p of whitelist) {
                allPoints.add(p)
            }
        }
        const npa = [...needPointsAround].sort((a, b) => a - b)
        const ap = [...allPoints].sort((a, b) => a - b)
        this.#ap = ap
        let pl = ap[0]
        /**
         * @type {Map<number, [number, number]>}
         */
        const pointsAround = new Map()
        for(const p of npa) {
            while(ap[0] < p) {
                pl = ap.shift()
            }
            pointsAround.set(p, [pl, ap[1]])
        }
        this.#pointsAround = pointsAround
        console.log("Initial points", sensorPointWhitelist)
        this.#getNextZeroPoint()
        this.#getNextSpanPoint()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        // We do _two_ passes here:
        // One for the zero points -> temp
        while (this.#nextZeroPoint) {
            this.#addZeroPointFull()
        }

        this.#zeroDeltas.sort((a, b) => a.y - b.y)

        // Then one for the nonzero points + <- temp
        while (this.#nextSpanPoint) {
            const nsp = this.#nextSpanPoint
            const i = this.#zeroDeltas.findIndex(d => d.y > nsp.y)
            if (i < 0) {
                // This means all remaining zero deltas are <= nsp.y
                this.#addDeltas(...this.#zeroDeltas)
                this.#zeroDeltas = []
            } else {
                this.#addDeltas(...this.#zeroDeltas.slice(0, i))
                this.#zeroDeltas = this.#zeroDeltas.slice(i)
            }
            this.#addNextSpanPoint()
        }

        return { combinedDeltas: this.#combinedDeltas, zeroDeltaSpan: this.#zeroDeltaSpan }
    }
}
