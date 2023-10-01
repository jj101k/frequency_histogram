//@ts-check

/**
 *
 */
class Histogram {
    /**
     * @type {{y: number, dF: number}[] | undefined}
     */
    #deltas

    /**
     * @type {{field: EpwNamedNumberField, expectedMinResolution?: number | undefined}}
     */
    #fieldInfo

    /**
     *
     */
    #parser
    /**
     * @type {Set<number>}
     */
    #yValues

    /**
     *
     */
    get combinedDeltas() {
        if(!this.#deltas) {
            this.#deltas = this.getDeltas()
        }
        /**
         * @type {{y: number, dF: number}[]}
         */
        const combinedDeltas = []
        if(this.#deltas.length) {
            let last = {y: this.#deltas[0].y, dF: this.#deltas[0].dF}
            combinedDeltas.push(last)
            for(const d of this.#deltas) {
                if(d.y == last.y) {
                    last.dF += d.dF
                } else {
                    last = {y: d.y, dF: d.dF}
                    combinedDeltas.push(last)
                }
            }
        }
        return combinedDeltas
    }

    /**
     *
     */
    get cumulativeDeltas() {
        /**
         * @type {{y: number, f: number}[]}
         */
        const cumulativeDeltas = []
        const combinedDeltas = this.combinedDeltas
        if(combinedDeltas.length) {
            let f = 0
            for(const d of combinedDeltas) {
                f += d.dF
                cumulativeDeltas.push({y: d.y, f})
            }
        }
        return cumulativeDeltas
    }

    get deltas() {
        if(!this.#deltas) {
            this.#deltas = this.getDeltas()
        }
        return this.#deltas.slice()
    }

    /**
     *
     */
    get fieldInfo() {
        return this.#fieldInfo
    }
    set fieldInfo(v) {
        this.#fieldInfo = v
        this.#deltas = undefined
    }

    getDeltas() {
        const dataPoints = this.#parser.getValues(this.#fieldInfo.field)

        let expectedMinDeltaY = this.#fieldInfo.expectedMinResolution
        if(expectedMinDeltaY === undefined) {
            /**
             * @type {Set<number>}
             */
            const yValues = new Set()
            for(const dataPoint of dataPoints) {
                if(dataPoint.y !== null && dataPoint.y !== undefined) {
                    yValues.add(dataPoint.y)
                }
            }
            let realMinDeltaY = Infinity
            const yValuesOrdered = [...yValues].sort((a, b) => a - b)
            let lastYValue = yValuesOrdered[0]
            for(const yValue of yValuesOrdered.slice(1)) {
                const deltaY = yValue - lastYValue
                if(deltaY < realMinDeltaY) {
                    realMinDeltaY = deltaY
                }
                lastYValue = yValue
            }

            expectedMinDeltaY = realMinDeltaY
        }
        const zeroDeltaSpan = expectedMinDeltaY / 2

        // Presume sorted in x
        const deltas = []
        let lastY = dataPoints[0].y ?? 0
        let lastX = dataPoints[0].x

        for(let i = 1; i < dataPoints.length; i++) {
            const dataPoint = dataPoints[i]
            if(dataPoint.y === null || dataPoint.y === undefined) {
                continue
            }
            /**
             * @type {number}
             */
            let lY
            /**
             * @type {number}
             */
            let hY
            /**
             * @type {number}
             */
            let dY
            if(Math.abs(dataPoint.y - lastY) < zeroDeltaSpan) {
                lY = Math.min(dataPoint.y, lastY)
                hY = lY + zeroDeltaSpan
                dY = zeroDeltaSpan
            } else {
                if(dataPoint.y < lastY) {
                    lY = dataPoint.y
                    hY = lastY
                } else {
                    lY = lastY
                    hY = dataPoint.y
                }
                dY = hY - lY
            }
            const dX = dataPoint.x - lastX
            // Push ADD and REMOVE.
            // We consider it to go UP at lY, go down at hY; and we consider
            // the height to be dX/dY' where dY' = max(dY, minDelta)
            const h = dX / dY
            deltas.push({y: lY, dF: h})
            deltas.push({y: hY, dF: -h})

            lastY = dataPoint.y
            lastX = dataPoint.x
        }
        deltas.sort((a, b) => a.y - b.y)

        return deltas
    }

    /**
     *
     * @param {EpwParser} parser
     */
    constructor(parser) {
        this.#parser = parser
    }
}