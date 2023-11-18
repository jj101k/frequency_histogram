/**
 * @abstract
 */
class HistogramDeltasAny {
    /**
     * @type {{y: number, dF: number}[]}
     */
    #combinedDeltas = []
    /**
     *
     */
    #spanPoints

    /**
     *
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
     * @type {{y: number, dF: number} | null}
     */
    nextSpanPoint = null
    /**
     * @protected
     * @type {{y: number, zeroSpan: number, dataSource: number} | null}
     */
    nextZeroPoint = null

    /**
     * @protected
     */
    zeroDeltaSpan

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
     * @param {{y: number, dF: number}[]} values
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
     * @param {number} lastY
     * @param {number} current
     * @param {number | undefined} nextY
     * @returns
     */
    afterPoint(lastY, current, nextY = undefined) {
        return nextY ?? (current + (current - lastY))
    }

    /**
     * @protected
     *
     * @param {number} current
     * @param {number} nextY
     */
    beforePoint(current, nextY) {
        return current - (nextY - current)
    }

    /**
     * @protected
     * @abstract
     */
    buildCombined() {
        throw new Error("Not implemented")
    }

    /**
     *
     */
    clearSpanPoints() {
        this.#spanPoints = []
    }

    /**
     * @protected
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
     */
    getNextZeroPoint() {
        this.nextZeroPoint = this.#shiftZeroPoints()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        this.buildCombined()
        return { combinedDeltas: this.#combinedDeltas, zeroDeltaSpan: this.zeroDeltaSpan }
    }

    /**
     *
     * @param {{y: number, dF: number}[]} deltas
     * @param {number} zeroDeltaSpan
     * @param {{y: number, zeroSpan: number, dataSource: number}[]} zeroWidthPoints
     */
    constructor(deltas, zeroDeltaSpan, zeroWidthPoints) {
        this.#spanPoints = deltas
        this.zeroDeltaSpan = zeroDeltaSpan
        this.#zeroWidthPoints = zeroWidthPoints
        this.getNextZeroPoint()
        this.#getNextSpanPoint()
    }
}