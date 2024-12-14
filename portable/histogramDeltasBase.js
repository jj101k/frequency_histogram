/// <reference path="types.d.ts" />

/**
 * @abstract
 * @implements {HistogramDeltasAny}
 */
class HistogramDeltasBase {
    /**
     * @type {DeltaDatum[]}
     */
    #combinedDeltas = []
    /**
     *
     */
    #maximum
    /**
     *
     */
    #minimum
    /**
     *
     */
    #spanPoints

    /**
     * These are points which have zero width, ie. the value does not change
     * between two adjacent time points. These must be sorted by y value (ascending).
     */
    #zeroWidthPoints

    /**
     *
     */
    #getNextSpanPoint() {
        this.nextSpanPoint = this.#shiftSpanPoints()
    }

    /**
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
     * Pops a zero point off the stack. If the first few have an identical y
     * value, they will be coalesced into one with an appropriately widened zero span.
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
     * @protected
     * @type {DeltaDatum | null}
     */
    nextSpanPoint = null
    /**
     * @protected
     * @type {ZeroWidthPoint | null}
     */
    nextZeroPoint = null

    /**
     * @protected
     * @readonly
     */
    precision

    /**
     * @protected
     */
    get allSpanPoints() {
        return this.#spanPoints.slice()
    }

    /**
     * @protected
     */
    get allZeroWidthPoints() {
        return this.#zeroWidthPoints.slice()
    }

    /**
     * @protected
     *
     * @param {DeltaDatum[]} values
     */
    addDeltas(...values) {
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
     * @protected
     */
    addNextSpanPoint() {
        if (this.nextSpanPoint) {
            this.addDeltas(this.nextSpanPoint)
            this.#getNextSpanPoint()
        }
    }

    /**
     * @protected
     *
     * This estimates where the next (higher) point would be, not exceeding the
     * maximum if supplied. This is used where a point is already the highest in
     * a set, although it's also safe to use otherwise.
     *
     * @param {number} lastY
     * @param {number} current
     * @param {number | undefined} nextY
     * @returns
     */
    afterPoint(lastY, current, nextY = undefined) {
        const after = nextY ?? (current + (current - lastY))
        if(this.#maximum !== undefined) {
            return Math.min(this.#maximum, after)
        } else {
            return after
        }
    }

    /**
     * @protected
     *
     * This estimates where the previous (lower) point would be, at least the
     * minimum if provided.
     *
     * @param {number} current
     * @param {number} nextY
     */
    beforePoint(current, nextY) {
        const before = current - (nextY - current)
        if(this.#minimum !== undefined) {
            return Math.max(this.#minimum, before)
        } else {
            return before
        }
    }

    /**
     * @protected
     * @abstract
     */
    buildCombined() {
        throw new Error("Not implemented")
    }

    /**
     * @protected
     */
    clearSpanPoints() {
        this.#spanPoints = []
    }

    /**
     * @protected
     *
     * Produces the before and after points for a zero-width point, based on
     * its actual predecessor and, ideally, its actual successor.
     *
     * @param {number} lastY
     * @param {number} current
     * @param {number | undefined} nextY
     * @returns
     */
    extrapolateAfter(lastY, current, nextY) {
        return {lastY, nextY: this.afterPoint(lastY, current, nextY)}
    }

    /**
     * @protected
     *
     * @param {number} current
     * @param {number} nextY
     * @returns
     */
    extrapolateBefore(current, nextY) {
        return {lastY: this.beforePoint(current, nextY), nextY}
    }

    /**
     * @protected
     *
     * Steps forward by one zero point, putting the one with the next y value
     * into nextZeroPoint
     *
     * @see nextZeroPoint
     */
    getNextZeroPoint() {
        this.nextZeroPoint = this.#shiftZeroPoints()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        this.buildCombined()
        return this.#combinedDeltas
    }

    /**
     *
     * @param {DeltaInfo} deltaInfo
     * @param {{maximum?: number, minimum?: number} | undefined} numberOptions
     */
    constructor(deltaInfo, numberOptions) {
        this.#spanPoints = deltaInfo.deltas
        this.precision = deltaInfo.precision
        this.#zeroWidthPoints = deltaInfo.zeroWidthPoints
        this.getNextZeroPoint()
        this.#getNextSpanPoint()
        this.#maximum = numberOptions?.maximum
        this.#minimum = numberOptions?.minimum
    }
}