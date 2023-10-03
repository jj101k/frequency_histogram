//@ts-check

/**
 *
 */
class Histogram {
    /**
     *
     */
    #combineSubDelta

    /**
     * @type {{deltas: {y: number, dF: number}[], zeroDeltaSpan: number} | undefined}
     */
    #deltaInfo

    /**
     * @type {{field: EpwNamedNumberField, expectedMinResolution?: number | undefined}}
     */
    #fieldInfo

    /**
     *
     */
    #parser

    /**
     *
     */
    get combined() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.getDeltas()
        }
        /**
         * @type {{y: number, dF: number}[]}
         */
        const combinedDeltas = []
        const deltas = this.#deltaInfo.deltas
        if(deltas.length) {
            let last = {y: deltas[0].y, dF: deltas[0].dF}
            combinedDeltas.push(last)
            for(const d of deltas) {
                if(d.y == last.y) {
                    last.dF += d.dF
                } else {
                    last = {y: d.y, dF: d.dF}
                    combinedDeltas.push(last)
                }
            }
        }
        return {combinedDeltas, zeroDeltaSpan: this.#deltaInfo.zeroDeltaSpan}
    }

    /**
     *
     */
    get cumulativeDeltas() {
        /**
         * @type {{y: number, f: number}[]}
         */
        const cumulativeDeltas = []
        const combined = this.combined
        const combinedDeltas = combined.combinedDeltas
        if(combinedDeltas.length) {
            let f = 0
            for(const d of combinedDeltas) {
                f += d.dF
                cumulativeDeltas.push({y: d.y, f})
            }
        }

        if(!this.#combineSubDelta) {
            return cumulativeDeltas
        }

        // console.log("ZDS:" + this.combined.zeroDeltaSpan)

        /**
         * @type {{y: number, f: number}[]}
         */
        const recombinedCumulativeDeltas = [cumulativeDeltas[0]]
        let lastRecombinedDelta = cumulativeDeltas[0]
        for(const delta of cumulativeDeltas.slice(1)) {
            const diff = delta.y - lastRecombinedDelta.y
            if(diff == 0 || diff > combined.zeroDeltaSpan) {
                recombinedCumulativeDeltas.push(delta)
                lastRecombinedDelta = delta
            } else {
                // Note: only supports _one_
                lastRecombinedDelta.f = (lastRecombinedDelta.f + delta.f) / 2
            }
        }

        return recombinedCumulativeDeltas
    }

    get deltas() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.getDeltas()
        }
        return this.#deltaInfo.deltas.slice()
    }

    /**
     *
     */
    get fieldInfo() {
        return this.#fieldInfo
    }
    set fieldInfo(v) {
        this.#fieldInfo = v
        this.#deltaInfo = undefined
    }

    /**
     *
     * @returns
     */
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

        /**
         * @type {{y: number, dF: number}[]}
         */
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
            if(Math.abs(dataPoint.y - lastY) < zeroDeltaSpan) {
                const mid = Math.round((dataPoint.y + lastY) / 2 / zeroDeltaSpan) * zeroDeltaSpan
                lY = mid - zeroDeltaSpan
                hY = mid + zeroDeltaSpan
            } else {
                if(dataPoint.y < lastY) {
                    lY = dataPoint.y
                    hY = lastY
                } else {
                    lY = lastY
                    hY = dataPoint.y
                }
            }
            const dY = hY - lY
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

        return {deltas, zeroDeltaSpan}
    }

    /**
     *
     * @param {EpwParser} parser
     * @param {boolean} combineSubDelta If true, spans less than delta
     * (typically, zero) will be combined with their non-delta counterparts
     */
    constructor(parser, combineSubDelta = false) {
        this.#parser = parser
        this.#combineSubDelta = combineSubDelta
    }
}