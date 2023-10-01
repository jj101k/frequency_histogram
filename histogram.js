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
     * @type {EpwNamedField}
     */
    #field

    /**
     *
     */
    #minDeltaY
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
    get field() {
        return this.#field
    }
    set field(v) {
        this.#field = v
        this.#deltas = undefined
    }

    getDeltas() {
        const dataPoints = this.#parser.getValues(this.field)
        // Presume sorted in x
        const deltas = []
        for(let i = 1; i < dataPoints.length; i++) {
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
            if(Math.abs(dataPoints[i].y - dataPoints[i-1].y) < this.#minDeltaY) {
                continue
                lY = Math.min(dataPoints[i].y, dataPoints[i-1].y)
                hY = lY + this.#minDeltaY
                dY = this.#minDeltaY
            } else {
                if(dataPoints[i].y < dataPoints[i-1].y) {
                    lY = dataPoints[i].y
                    hY = dataPoints[i-1].y
                } else {
                    lY = dataPoints[i-1].y
                    hY = dataPoints[i].y
                }
                dY = hY - lY
            }
            const dX = dataPoints[i].x - dataPoints[i-1].x
            // Push ADD and REMOVE.
            // We consider it to go UP at lY, go down at hY; and we consider
            // the height to be dX/dY' where dY' = max(dY, minDelta)
            const h = dX / dY
            deltas.push({y: lY, dF: h})
            deltas.push({y: hY, dF: -h})
        }
        deltas.sort((a, b) => a.y - b.y)

        return deltas
    }

    /**
     *
     * @param {EpwParser} parser
     * @param {number} minDeltaY The narrowest width at which the data may be presented
     */
    constructor(parser, minDeltaY) {
        this.#minDeltaY = minDeltaY
        this.#parser = parser
    }
}