/**
 *
 */
class HistogramDeltasAny {
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
}