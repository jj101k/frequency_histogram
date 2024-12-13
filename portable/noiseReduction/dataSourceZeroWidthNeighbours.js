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
     *
     * @returns
     */
    #shiftPoints() {
        return this.points.shift() ?? null
    }

    /**
     * The current point to consider (lower than everything in points)
     */
    nextPoint
    /**
     * The possible neighbour points, in ascending order
     */
    points

    /**
     *
     * @param {Iterable<number>} points These must be in ascending order
     */
    constructor(points) {
        this.points = [...points]
        this.nextPoint = this.#shiftPoints()
    }

    /**
     * Replace nextPoint by shifting points
     */
    getNext() {
        this.nextPoint = this.#shiftPoints()
    }
}
