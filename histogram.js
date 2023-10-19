//@ts-check

/**
 *
 */
class Histogram {
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

        /**
         *
         * @param {{y: number, dF: number}[]} values
         */
        const addDeltas = (...values) => {
            if(!values.length) {
                return 0
            }
            let vL = combinedDeltas[combinedDeltas.length - 1]
            let added = 0
            if(!vL) {
                vL = values[0]
                values.shift()
                combinedDeltas.push(vL)
                added++
            }
            for(const v of values) {
                if(v.y == vL.y) {
                    vL.dF += v.dF
                } else {
                    combinedDeltas.push(v)
                    added++
                    vL = v
                }
            }
            return added
        }

        if(zeroWidthPoints.length) {
            /**
             *
             * @param {{y: number, dF: number}[]} values
             */
            const combineSpans = (values) => {
                const v0 = values.shift()
                if(!v0) {
                    return null
                }
                const out = {...v0}
                while(values.length && values[0].y == v0.y) {
                    out.dF += values[0].dF
                    values.shift()
                }
                return out
            }
            /**
             *
             * @param {{y: number, zeroSpan: number}[]} values
             */
            const combineZeroes = (values) => {
                const v0 = values.shift()
                if(!v0) {
                    return null
                }
                const out = {...v0}
                while(values.length && values[0].y == v0.y) {
                    out.zeroSpan += values[0].zeroSpan
                    values.shift()
                }
                return out
            }
            /**
             *
             * @param {{y: number, zeroSpan: number}} zeroPoint
             * @param {number} lowY
             * @param {number} highY
             */
            const zeroPointsAt = (zeroPoint, lowY, highY) => {
                return [
                    {y: (lowY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (highY - lowY)},
                    {y: (highY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (highY - lowY)},
                ]
            }

            let nextZeroPoint = combineZeroes(zeroWidthPoints)
            let nextSpanPoint = combineSpans(deltas)
            /**
             * @type {number | undefined}
             */
            let lastY
            while(nextSpanPoint && nextZeroPoint) {
                if(nextSpanPoint.y < nextZeroPoint.y) {
                    // If the span points are early, we can just push them.
                    if(lastY === undefined || lastY != nextSpanPoint.y) {
                        lastY = nextSpanPoint.y
                    }
                    addDeltas(nextSpanPoint)
                    nextSpanPoint = combineSpans(deltas)
                    continue
                }
                // The current span point(s) are either EQUAL or GREATER.
                /**
                 * @type {number[]}
                 */
                const possibleNextY = []
                if(nextSpanPoint.y > nextZeroPoint.y) {
                    possibleNextY.push(nextSpanPoint.y)
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
                        lastY = nextZeroPoint.y - (nextY - nextSpanPoint.y)
                    }
                    const [lowZeroPoint, highZeroPoint] = zeroPointsAt(nextZeroPoint, lastY, nextY)
                    // Now we have the answer we can push the "before" value
                    addDeltas(lowZeroPoint)
                    // Then the equal value, if applicable.
                    if(nextSpanPoint.y == nextZeroPoint.y) {
                        addDeltas(nextSpanPoint)
                        nextSpanPoint = combineSpans(deltas)
                    }
                    // Then the "after" value.
                    addDeltas(highZeroPoint)
                    lastY = nextZeroPoint.y
                    nextZeroPoint = combineZeroes(zeroWidthPoints)
                } else if(lastY === undefined) {
                    // This would happen if if there were exactly one point,
                    // which was a zero point.

                    // This is actually handled below.
                    break
                } else {
                    // There are no next Y values. This happens if:
                    // The current span is EQUAL and
                    // There are no points after this.

                    const nextY = nextZeroPoint.y + (nextZeroPoint.y - lastY)
                    const lY = lastY

                    const [lowZeroPoint, highZeroPoint] = zeroPointsAt(nextZeroPoint, lY, nextY)

                    // Now we have the answer we can push the "before" value
                    addDeltas(lowZeroPoint)
                    // Then the equal value
                    addDeltas(nextSpanPoint)
                    // But we actually put the "after" value exactly on the point.
                    addDeltas(highZeroPoint)

                    // And we know we're done
                    break
                }
            }

            // If there are non-zeroes left, just push them.
            if(nextSpanPoint) {
                addDeltas(nextSpanPoint)
            }
            addDeltas(...deltas)

            // If there are zeroes left, follow a tighter loop.
            if(nextZeroPoint) {
                while(zeroWidthPoints.length) {
                    // The few towards the end
                    const nextY = zeroWidthPoints[0].y
                    if(lastY === undefined) {
                        // Estimate
                        lastY = nextZeroPoint.y - (nextY - nextZeroPoint.y)
                    }
                    addDeltas(...zeroPointsAt(nextZeroPoint, lastY, nextY))
                    lastY = nextZeroPoint.y
                    nextZeroPoint = combineZeroes(zeroWidthPoints)
                    if(!nextZeroPoint) {
                        throw new Error("Internal error")
                    }
                }
                if(lastY === undefined) {
                    // There is exactly one point, and it's a zero.
                    const lastY = nextZeroPoint.y - zeroDeltaSpan
                    const nextY = nextZeroPoint.y + zeroDeltaSpan
                    addDeltas(...zeroPointsAt(nextZeroPoint, lastY, nextY))
                } else {
                    // Very last zero point. Here, we'll have lastY only.
                    const nextY = nextZeroPoint.y + (nextZeroPoint.y - lastY)
                    addDeltas(...zeroPointsAt(nextZeroPoint, lastY, nextY))
                }
            }
        } else {
            addDeltas(...deltas)
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

        return cumulativeDeltas
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
        // Special case: exactly one point
        if(dataPoints.length == 1) {
            return {deltas: [], zeroDeltaSpan: this.#fieldInfo.expectedMinResolution ?? 1,
                zeroWidthPoints: [{y: dataPoints[0].y, zeroSpan: 1}]}
        }
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
                //
                // We consider it to go UP at lY, go down at hY; and we consider
                // the height to be dX / dY.
                //
                // Some explanation needed here: this represents the time at the
                // point value. If the spread of (dY) values is twice as much,
                // the time at any point is half as much. If the spread of time
                // (dX) is twice as much (as would be true if you just added
                // adjacent periods), the time at any point is twie as much.
                // Thus dX / dY.
                //
                // Most of the time here, dX will be 1.
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
     */
    constructor(parser) {
        this.#parser = parser
    }
}