//@ts-check

/**
 *
 */
class SensorWhitelistState {
    /**
     *
     * @returns
     */
    #shiftPoints() {
        return this.points.shift() ?? null
    }

    /**
     *
     */
    nextPoint
    /**
     *
     */
    points

    /**
     *
     * @param {Iterable<number>} points
     */
    constructor(points) {
        this.points = [...points]
        this.nextPoint = this.#shiftPoints()
    }

    /**
     *
     */
    getNext() {
        this.nextPoint = this.#shiftPoints()
    }
}
