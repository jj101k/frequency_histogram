//@ts-check

/**
 *
 */
class HistogramDeltas {
    /**
     * @type {{y: number, dF: number}[]}
     */
    #combinedDeltas = [];
    /**
     * @type {number | undefined}
     */
    #lastY
    /**
     * @type {{y: number, dF: number} | null}
     */
    #nextSpanPoint = null;
    /**
     * @type {{y: number, zeroSpan: number} | null}
     */
    #nextZeroPoint = null;
    /**
     *
     */
    #spanPoints
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
        /**
         * @type {number}
         */
        let nextY
        // The current span point(s) are either EQUAL or GREATER.
        /**
         * @type {number[]}
         */
        const possibleNextY = []
        if (this.#nextSpanPoint && this.#nextSpanPoint.y > zeroPoint.y) {
            possibleNextY.push(this.#nextSpanPoint.y)
        } else if (this.#spanPoints.length) {
            possibleNextY.push(this.#spanPoints[0].y)
        }
        if (this.#zeroWidthPoints.length) {
            possibleNextY.push(this.#zeroWidthPoints[0].y)
        }
        if (possibleNextY.length) {
            nextY = Math.min(...possibleNextY)
        } else if (this.#lastY) {
            nextY = zeroPoint.y + (zeroPoint.y - this.#lastY)
        } else {
            // This is an estimate!
            nextY = zeroPoint.y + this.#zeroDeltaSpan
        }
        const nextLastY = zeroPoint.y
        // Estimate if needed
        const lastY = this.#lastY ?? (zeroPoint.y - (nextY - zeroPoint.y))
        const [lowZeroPoint, highZeroPoint] = [
            { y: (lastY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (nextY - lastY) },
            { y: (nextY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (nextY - lastY) },
        ]
        // Now we have the answer we can push the "before" value
        this.#addDeltas(lowZeroPoint)
        // Then the equal value, if applicable.
        if (this.#nextSpanPoint && this.#nextSpanPoint.y == zeroPoint.y) {
            this.#addNextSpanPoint()
        }
        // Then the "after" value.
        this.#addDeltas(highZeroPoint)
        this.#getNextZeroPoint()
        this.#lastY = nextLastY
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
     * @param {{y: number, zeroSpan: number}[]} zeroWidthPoints
     */
    constructor(deltas, zeroDeltaSpan, zeroWidthPoints) {
        this.#spanPoints = deltas
        this.#zeroDeltaSpan = zeroDeltaSpan
        this.#zeroWidthPoints = zeroWidthPoints
        this.#getNextZeroPoint()
        this.#getNextSpanPoint()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        // When you have a-b-c and b is a zero point, you get:
        // [a, Va]-[mid(a, b) V.(mid(a, b), mid(b, c))]-
        // [mid(b, c) V.(mid(a, b), mid(b, c))]-[c, Vc]
        // This tries to go through both lists to merge them, but future points
        // may appear on either or both (we can imagine that past points
        // cannot).
        // Any non-zero points which happen to be at the same stop have to be
        // stacked up, because a point will be deployed _before_ them.
        while (this.#nextSpanPoint && this.#nextZeroPoint) {
            while (this.#nextSpanPoint && this.#nextSpanPoint.y < this.#nextZeroPoint.y) {
                // If the span points are early, we can just push them.
                if (this.#lastY === undefined || this.#lastY != this.#nextSpanPoint.y) {
                    this.#lastY = this.#nextSpanPoint.y
                }
                this.#addNextSpanPoint()
            }
            this.#addZeroPointFull()
        }

        // If there are non-zeroes left, just push them.
        const spanPoints = this.#spanPoints
        this.#spanPoints = []
        this.#addNextSpanPoint()
        this.#addDeltas(...spanPoints)

        // If there are zeroes left, follow a tighter loop.
        while (this.#nextZeroPoint) {
            this.#addZeroPointFull()
        }

        return { combinedDeltas: this.#combinedDeltas, zeroDeltaSpan: this.#zeroDeltaSpan }
    }
}
