/**
 * This is the set of points which could be neighbours to a zero-width point.
 * This is designed to be used destructively, with values discarded as you go.
 *
 * There is one per data source because some of them may offer different values,
 * eg. if you have rainfall in inches on one source and in cm on another, after
 * converting to the same unit (cm) it's likely that the closest values to 3
 * will likely be 2 & 4 on one source, and 2.54 and 5.08 on another.
 */
class DataSourceZeroWidthNeighbours {
    /**
     * The current point to consider (lower than everything in points). This
     * will remain set at all times.
     */
    nextPoint
    /**
     * The possible neighbour points, in ascending order. This can be empty.
     */
    points

    /**
     *
     */
    get hasHigherPoints() {
        return this.points.length > 0
    }

    /**
     * @throws
     * @type {number}
     */
    get higherPoint() {
        const point = this.possibleHigherPoint
        if(point === undefined) {
            throw new Error("Internal error: all points have been exhausted")
        }
        return point
    }

    /**
     * @type {number | undefined}
     */
    get possibleHigherPoint() {
        return this.points[0]
    }

    /**
     *
     * @param {Iterable<number>} points These must be in ascending order
     * @throws
     */
    constructor(points) {
        this.points = [...points]
        this.nextPoint = this.higherPoint
        this.points.shift()
    }

    /**
     * Replace nextPoint by shifting points
     *
     * @throws
     */
    getNext() {
        this.nextPoint = this.higherPoint
        this.points.shift()
    }
}
