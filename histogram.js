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
     * @type {{deltas: {y: number, dF: number, zeroSpan?: undefined}[], zeroWidthPoints: {y: number,
     * zeroSpan: number}[], zeroDeltaSpan: number} | undefined}
     */
    #deltaInfo

    /**
     * @type {{field: EpwNamedNumberField, expectedMinResolution?: number | undefined}}
     */
    #fieldInfo

    /**
     * @type {{y: number, f: number}[] | undefined}
     */
    #frequencies

    /**
     * @type {number | undefined}
     */
    #limit

    /**
     *
     */
    #parser

    /**
     * This provides the deltas with all values with the same y value combined.
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
        const zeroDeltaSpan = this.#deltaInfo.zeroDeltaSpan
        const zeroWidthPoints = this.#deltaInfo.zeroWidthPoints

        // When you have a-b-c and b is a zero point, you get:
        // [a, Va]-[mid(a, b) V.(mid(a, b), mid(b, c))]-
        // [mid(b, c) V.(mid(a, b), mid(b, c))]-[c, Vc]

        // This tries to go through both lists to merge them, but future points
        // may appear on either or both (we can imagine that past points
        // cannot).

        // Any non-zero points which happen to be at the same stop have to be
        // stacked up, because a point will be deployed _before_ them.

        if(deltas.length && zeroWidthPoints.length) {
            /**
             *
             * @template {{y: number}} T
             * @param {T[]} values
             */
            const shiftSameY = (values) => {
                const v0 = values.shift()
                if(!v0) {
                    return []
                }
                const out = [v0]
                while(values.length && values[0].y == v0.y) {
                    out.push(values[0])
                    values.shift()
                }
                return out
            }

            /**
             * @type {{y: number, dF: number}[]}
             */
            const normalisedDeltas = []
            let nextZeroPoints = shiftSameY(zeroWidthPoints)
            let nextSpanPoints = shiftSameY(deltas)
            /**
             * @type {number | undefined}
             */
            let lastY
            while(nextSpanPoints.length && nextZeroPoints.length) {
                if(nextSpanPoints[0].y < nextZeroPoints[0].y) {
                    // If the span points are early, we can just push them.
                    if(lastY === undefined || lastY != nextSpanPoints[0].y) {
                        lastY = nextSpanPoints[0].y
                    }
                    normalisedDeltas.push(...nextSpanPoints)
                    nextSpanPoints = shiftSameY(deltas)
                    continue
                }
                // The current span point(s) are either EQUAL or GREATER.
                /**
                 * @type {number[]}
                 */
                const possibleNextY = []
                if(nextSpanPoints[0].y > nextZeroPoints[0].y) {
                    possibleNextY.push(nextSpanPoints[0].y)
                } else if(deltas.length) {
                    possibleNextY.push(deltas[0].y)
                }
                if(zeroWidthPoints.length) {
                    possibleNextY.push(zeroWidthPoints[0].y)
                }
                if(possibleNextY.length) {
                    const nextY = Math.min(...possibleNextY)
                    if(lastY === undefined) {
                        // Estimate
                        lastY = nextZeroPoints[0].y - (nextY - nextSpanPoints[0].y)
                    }
                    const lY = lastY
                    // Now we have the answer we can push the "before" value
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (lY + p.y) / 2, dF: p.zeroSpan / (nextY - lY)})))
                    // Then the equal value, if applicable.
                    if(nextSpanPoints[0].y == nextZeroPoints[0].y) {
                        normalisedDeltas.push(...nextSpanPoints)
                        nextSpanPoints = shiftSameY(deltas)
                    }
                    // Then the "after" value.
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (nextY + p.y), dF: -p.zeroSpan / (nextY - lY)})))
                    lastY = nextZeroPoints[0].y
                    nextZeroPoints = shiftSameY(zeroWidthPoints)
                } else if(lastY === undefined) {
                    // This would happen in principle if there was exactly one
                    // point, which was a zero point.
                    //
                    // But that's caught above.
                    throw new Error("Internal state error")
                } else {
                    // There are no next Y values. This happens if:
                    // The current span is EQUAL and
                    // There are no points after this.

                    const nextY = nextZeroPoints[0].y + (nextZeroPoints[0].y - lastY)
                    const lY = lastY

                    // Now we have the answer we can push the "before" value
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (lY + p.y) / 2, dF: p.zeroSpan / (nextY - lY)})))
                    // Then the equal value
                    normalisedDeltas.push(...nextSpanPoints)
                    // But we actually put the "after" value exactly on the point.
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: p.y, dF: -p.zeroSpan / (nextY - lY)})))

                    // And we know we're done
                    break
                }
            }

            // If there are non-zeroes left, just push them.
            normalisedDeltas.push(...nextSpanPoints, ...deltas)

            // If there are zeroes left, follow a tighter loop.
            if(nextZeroPoints.length) {
                while(zeroWidthPoints.length) {
                    // The few towards the end
                    const nextY = zeroWidthPoints[0].y
                    if(lastY === undefined) {
                        // Estimate
                        lastY = nextZeroPoints[0].y - (nextY - nextSpanPoints[0].y)
                    }
                    const lY = lastY
                    // Now we have the answer we can push the "before" value
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (lY + p.y) / 2, dF: p.zeroSpan / (nextY - lY)})))
                    // Then the "after" value.
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (nextY + p.y) / 2, dF: -p.zeroSpan / (nextY - lY)})))
                    lastY = nextZeroPoints[0].y
                    nextZeroPoints = shiftSameY(zeroWidthPoints)
                }
                if(lastY === undefined) {
                    // There is exactly one point, and it's a zero.
                    const lastY = nextZeroPoints[0].y - zeroDeltaSpan
                    const nextY = nextZeroPoints[0].y + zeroDeltaSpan
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (lastY + p.y) / 2, dF: p.zeroSpan / (nextY - lastY)})))
                    // But we actually put the "after" value exactly on the point.
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: p.y, dF: -p.zeroSpan / (nextY - lastY)})))
                } else {
                    const lY = lastY
                    // Very last zero point. Here, we'll have lastY only.
                    const nextY = nextZeroPoints[0].y + (nextZeroPoints[0].y - lastY)
                    // Now we have the answer we can push the "before" value
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: (lY + p.y) / 2, dF: p.zeroSpan / (nextY - lY)})))
                    // But we actually put the "after" value exactly on the point.
                    normalisedDeltas.push(...nextZeroPoints.map(p => ({y: p.y, dF: -p.zeroSpan / (nextY - lY)})))
                }
            }
            if(normalisedDeltas.length) {
                let last = {y: normalisedDeltas[0].y, dF: normalisedDeltas[0].dF}
                combinedDeltas.push(last)
                for(const d of normalisedDeltas) {
                    if(d.y == last.y) {
                        last.dF += d.dF
                    } else {
                        last = {y: d.y, dF: d.dF}
                        combinedDeltas.push(last)
                    }
                }
            }
        } else {
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

        return {combinedDeltas, zeroDeltaSpan}
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

    get frequencies() {
        if(!this.#frequencies) {
            this.#frequencies = this.getFrequencies()
        }
        return this.#frequencies.slice()
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
        this.#frequencies = undefined
    }

    /**
     *
     */
    get limit() {
        return this.#limit
    }
    set limit(v) {
        this.#limit = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     * @returns
     */
    getDeltas() {
        const dataPoints = this.#parser.getValues(this.#fieldInfo.field, this.#limit)

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

        // This will be a fraction, so we'll try to get a good decimal
        // representation for sanity's sake.
        const decimalDigits = 10
        const nominalZeroDeltaSpan = expectedMinDeltaY / 2
        const headDigits = Math.floor(Math.log10(nominalZeroDeltaSpan))
        const roundTo = Math.pow(10, decimalDigits - headDigits)
        const zeroDeltaSpan = Math.round(nominalZeroDeltaSpan * roundTo) / roundTo

        // Presume sorted in x

        /**
         * @type {{y: number, dF: number, zeroSpan?: undefined}[]}
         */
        const deltas = []
        /**
         * @type {{y: number, zeroSpan: number}[]}
         */
        const zeroWidthPoints = []
        let lastY = dataPoints[0].y ?? 0
        let lastX = dataPoints[0].x

        for(let i = 1; i < dataPoints.length; i++) {
            const dataPoint = dataPoints[i]
            if(dataPoint.y === null || dataPoint.y === undefined) {
                continue
            }
            const dX = dataPoint.x - lastX
            if(Math.abs(dataPoint.y - lastY) < zeroDeltaSpan) {
                if(dataPoint.y === lastY) {
                    // Either is fine
                    zeroWidthPoints.push({y: dataPoint.y, zeroSpan: dX})
                } else {
                    // We pick one, whichever has the shortest decimal
                    // representation.
                    const shortest = [dataPoint.y, lastY].sort((a, b) => a.toString().length - b.toString().length)[0]
                    zeroWidthPoints.push({y: shortest, zeroSpan: dX})
                }
            } else {
                /**
                 * @type {number}
                 */
                let lY
                /**
                 * @type {number}
                 */
                let hY
                if(dataPoint.y < lastY) {
                    lY = dataPoint.y
                    hY = lastY
                } else {
                    lY = lastY
                    hY = dataPoint.y
                }
                const dY = hY - lY
                // Push ADD and REMOVE.
                // We consider it to go UP at lY, go down at hY; and we consider
                // the height to be dX/dY' where dY' = max(dY, minDelta)
                const h = dX / dY
                deltas.push({y: lY, dF: h})
                deltas.push({y: hY, dF: -h})
            }

            lastY = dataPoint.y
            lastX = dataPoint.x
        }
        deltas.sort((a, b) => a.y - b.y)
        zeroWidthPoints.sort((a, b) => a.y - b.y)

        return {deltas, zeroDeltaSpan, zeroWidthPoints}
    }


    /**
     *
     * @returns
     */
    getFrequencies() {
        const dataPoints = this.#parser.getValues(this.#fieldInfo.field, this.#limit)

        /**
         * @type {Record<number, number>}
         */
        const frequencies = {}
        for(const dataPoint of dataPoints) {
            if(dataPoint.y === undefined || dataPoint.y === null) {
                continue
            }
            if(!frequencies[dataPoint.y]) {
                frequencies[dataPoint.y] = 0
            }
            frequencies[dataPoint.y]++
        }
        return Object.entries(frequencies).map(([y, f]) => ({y: +y, f})).sort((a, b) => a.y - b.y)
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