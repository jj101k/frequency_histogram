/// <reference path="histogramDeltasBase.js" />

/**
 *
 */
class HistogramDeltas extends HistogramDeltasBase {
    /**
     * @type {number | undefined}
     */
    #lastY

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
        const nextLastY = zeroPoint.y

        const {lastY, nextY} = this.#getZeroPointEdges(zeroPoint)

        const [lowZeroPoint, highZeroPoint] = [
            { y: (lastY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (nextY - lastY) },
            { y: (nextY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (nextY - lastY) },
        ]
        // Now we have the answer we can push the "before" value
        this.addDeltas(lowZeroPoint)
        // Then the equal value, if applicable.
        if (this.nextSpanPoint && this.nextSpanPoint.y == zeroPoint.y) {
            this.addNextSpanPoint()
        }
        // Then the "after" value.
        this.addDeltas(highZeroPoint)
        this.getNextZeroPoint()
        this.#lastY = nextLastY
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
        /**
         * @type {number}
         */
        let nextY
        // The current span point(s) are either EQUAL or GREATER.
        /**
         * @type {number[]}
         */
        const possibleNextY = []
        if (this.nextSpanPoint && this.nextSpanPoint.y > zeroPoint.y) {
            possibleNextY.push(this.nextSpanPoint.y)
        } else if (this.allSpanPoints.length) {
            possibleNextY.push(this.allSpanPoints[0].y)
        }
        const allZeroWidthPoints = this.allZeroWidthPoints
        if (allZeroWidthPoints.length) {
            possibleNextY.push(allZeroWidthPoints[0].y)
        }
        if (possibleNextY.length) {
            nextY = Math.min(...possibleNextY)
        } else if (this.#lastY) {
            nextY = this.afterPoint(this.#lastY, zeroPoint.y)
        } else {
            // This is an estimate!
            nextY = zeroPoint.y + this.precision
        }
        // Estimate if needed
        const lastY = this.#lastY ?? this.beforePoint(zeroPoint.y, nextY)
        return {lastY, nextY}
    }

    buildCombined() {
        // When you have a-b-c and b is a zero point, you get:
        // [a, Va]-[mid(a, b) V.(mid(a, b), mid(b, c))]-
        // [mid(b, c) V.(mid(a, b), mid(b, c))]-[c, Vc]
        // This tries to go through both lists to merge them, but future points
        // may appear on either or both (we can imagine that past points
        // cannot).
        // Any non-zero points which happen to be at the same stop have to be
        // stacked up, because a point will be deployed _before_ them.
        while (this.nextSpanPoint && this.nextZeroPoint) {
            while (this.nextSpanPoint && this.nextSpanPoint.y < this.nextZeroPoint.y) {
                // If the span points are early, we can just push them.
                if (this.#lastY === undefined || this.#lastY != this.nextSpanPoint.y) {
                    this.#lastY = this.nextSpanPoint.y
                }
                this.addNextSpanPoint()
            }
            this.#addZeroPointFull()
        }

        // If there are non-zeroes left, just push them.
        const spanPoints = this.allSpanPoints
        this.clearSpanPoints()
        this.addNextSpanPoint()
        this.addDeltas(...spanPoints)

        // If there are zeroes left, follow a tighter loop.
        while (this.nextZeroPoint) {
            this.#addZeroPointFull()
        }
    }
}
