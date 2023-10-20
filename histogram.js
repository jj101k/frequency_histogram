//@ts-check

/**
 *
 */
class HistogramDeltas {
    /**
     * @type {{y: number, dF: number}[]}
     */
    #combinedDeltas = []
    /**
     * @type {number | undefined}
     */
    #lastY
    /**
     * @type {{y: number, dF: number} | null}
     */
    #nextSpanPoint = null
    /**
     * @type {{y: number, zeroSpan: number} | null}
     */
    #nextZeroPoint = null
    /**
     *
     */
    #spanPoints
    /**
     *
     */
    #zeroDeltaSpan
    /**
     *
     */
    #zeroWidthPoints

    /**
     *
     * @param {{y: number, dF: number}[]} values
     */
    #addDeltas(...values) {
        if(!values.length) {
            return 0
        }
        let vL = this.#combinedDeltas[this.#combinedDeltas.length - 1]
        let added = 0
        if(!vL) {
            vL = values[0]
            values.shift()
            this.#combinedDeltas.push(vL)
            added++
        }
        for(const v of values) {
            if(v.y == vL.y) {
                vL.dF += v.dF
            } else {
                this.#combinedDeltas.push(v)
                added++
                vL = v
            }
        }
        return added
    }

    /**
     *
     */
    #addNextSpanPoint() {
        if(this.#nextSpanPoint) {
            this.#addDeltas(this.#nextSpanPoint)
            this.#getNextSpanPoint()
        }
    }

    /**
     *
     */
    #addRemainingSpanPoints() {
        if(this.#nextSpanPoint) {
            this.#addDeltas(this.#nextSpanPoint)
            this.#nextSpanPoint = null
        }
        this.#addDeltas(...this.#spanPoints)
        this.#spanPoints = []
    }

    /**
     *
     * @param {number} lastY
     * @param {number} nextY
     */
    #addZeroPointSpanning(lastY, nextY) {
        if(this.#nextZeroPoint) {
            const nextLastY = this.#nextZeroPoint.y
            const [lowZeroPoint, highZeroPoint] = this.#zeroPointsAt(this.#nextZeroPoint, lastY, nextY)
            // Now we have the answer we can push the "before" value
            this.#addDeltas(lowZeroPoint)
            // Then the equal value, if applicable.
            if (this.#nextSpanPoint && this.#nextSpanPoint.y == this.#nextZeroPoint.y) {
                this.#addNextSpanPoint()
            }
            // Then the "after" value.
            this.#addDeltas(highZeroPoint)
            this.#getNextZeroPoint()
            this.#lastY = nextLastY
        }
    }

    /**
     *
     */
    #getNextSpanPoint() {
        this.#nextSpanPoint = this.#shiftSpanPoints()
    }

    #getNextZeroPoint() {
        this.#nextZeroPoint = this.#shiftZeroPoints()
    }

    /**
     *
     * @returns
     */
    #shiftSpanPoints() {
        const v0 = this.#spanPoints.shift()
        if(!v0) {
            return null
        }
        const out = {...v0}
        while(this.#spanPoints.length && this.#spanPoints[0].y == v0.y) {
            out.dF += this.#spanPoints[0].dF
            this.#spanPoints.shift()
        }
        return out
    }

    /**
     *
     * @returns
     */
    #shiftZeroPoints() {
        const v0 = this.#zeroWidthPoints.shift()
        if(!v0) {
            return null
        }
        const out = {...v0}
        while(this.#zeroWidthPoints.length && this.#zeroWidthPoints[0].y == v0.y) {
            out.zeroSpan += this.#zeroWidthPoints[0].zeroSpan
            this.#zeroWidthPoints.shift()
        }
        return out
    }

    /**
     *
     * @param {{y: number, zeroSpan: number}} zeroPoint
     * @param {number} lowY
     * @param {number} highY
     */
    #zeroPointsAt(zeroPoint, lowY, highY) {
        return [
            {y: (lowY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (highY - lowY)},
            {y: (highY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (highY - lowY)},
        ]
    }

    /**
     *
     * @param {{y: number, dF: number}[]} deltas
     * @param {number} zeroDeltaSpan
     * @param {{y: number, zeroSpan: number}[]} zeroWidthPoints
     */
    constructor(deltas, zeroDeltaSpan, zeroWidthPoints) {
        this.#spanPoints = deltas
        this.#zeroDeltaSpan = zeroDeltaSpan
        this.#zeroWidthPoints = zeroWidthPoints
        this.#getNextZeroPoint()
        this.#getNextSpanPoint()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        // When you have a-b-c and b is a zero point, you get:
        // [a, Va]-[mid(a, b) V.(mid(a, b), mid(b, c))]-
        // [mid(b, c) V.(mid(a, b), mid(b, c))]-[c, Vc]

        // This tries to go through both lists to merge them, but future points
        // may appear on either or both (we can imagine that past points
        // cannot).

        // Any non-zero points which happen to be at the same stop have to be
        // stacked up, because a point will be deployed _before_ them.

        while(this.#nextSpanPoint && this.#nextZeroPoint) {
            if(this.#nextSpanPoint.y < this.#nextZeroPoint.y) {
                // If the span points are early, we can just push them.
                if(this.#lastY === undefined || this.#lastY != this.#nextSpanPoint.y) {
                    this.#lastY = this.#nextSpanPoint.y
                }
                this.#addNextSpanPoint()
                continue
            }
            // The current span point(s) are either EQUAL or GREATER.
            /**
             * @type {number[]}
             */
            const possibleNextY = []
            if(this.#nextSpanPoint.y > this.#nextZeroPoint.y) {
                possibleNextY.push(this.#nextSpanPoint.y)
            } else if(this.#spanPoints.length) {
                possibleNextY.push(this.#spanPoints[0].y)
            }
            if(this.#zeroWidthPoints.length) {
                possibleNextY.push(this.#zeroWidthPoints[0].y)
            }
            if(possibleNextY.length) {
                const nextY = Math.min(...possibleNextY)
                if(this.#lastY === undefined) {
                    // Estimate
                    this.#lastY = this.#nextZeroPoint.y - (nextY - this.#nextSpanPoint.y)
                }
                this.#addZeroPointSpanning(this.#lastY, nextY)
            } else if(this.#lastY === undefined) {
                // This would happen if if there were exactly one point,
                // which was a zero point.

                // This is actually handled below.
                break
            } else {
                // There are no next Y values. This happens if:
                // The current span is EQUAL and
                // There are no points after this.

                const nextY = this.#nextZeroPoint.y + (this.#nextZeroPoint.y - this.#lastY)

                this.#addZeroPointSpanning(this.#lastY, nextY)
            }
        }

        // If there are non-zeroes left, just push them.
        this.#addRemainingSpanPoints()

        // If there are zeroes left, follow a tighter loop.
        if(this.#nextZeroPoint) {
            while(this.#zeroWidthPoints.length) {
                // The few towards the end
                const nextY = this.#zeroWidthPoints[0].y
                if(this.#lastY === undefined) {
                    // Estimate
                    this.#lastY = this.#nextZeroPoint.y - (nextY - this.#nextZeroPoint.y)
                }
                this.#addZeroPointSpanning(this.#lastY, nextY)
                if(!this.#nextZeroPoint) {
                    throw new Error("Internal error")
                }
            }
            /**
             * @type {number}
             */
            let lY
            /**
             * @type {number}
             */
            let nY
            if(this.#lastY === undefined) {
                // There is exactly one point, and it's a zero.
                lY = this.#nextZeroPoint.y - this.#zeroDeltaSpan
                nY = this.#nextZeroPoint.y + this.#zeroDeltaSpan
            } else {
                // Very last zero point. Here, we'll have this.#lastY only.
                lY = this.#lastY
                nY = this.#nextZeroPoint.y + (this.#nextZeroPoint.y - this.#lastY)
            }
            this.#addZeroPointSpanning(lY, nY)
        }

        return {combinedDeltas: this.#combinedDeltas, zeroDeltaSpan: this.#zeroDeltaSpan}
    }
}

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
        return new HistogramDeltas(this.#deltaInfo.deltas, this.#deltaInfo.zeroDeltaSpan, this.#deltaInfo.zeroWidthPoints).combined
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
            if(yValues.size > 1) {
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
            } else {
                console.warn("Not enough distinct values for a delta calculation, will use 1")
                expectedMinDeltaY = 1
            }
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
        const dataPoint0 = dataPoints[0]

        // The first point gets injected as if there were an identical point
        // before it (using the _next_ to guess the distance)
        if(dataPoint0.y !== null && dataPoint0.y !== undefined) {
            const dX = dataPoints[1].x - dataPoint0.x // Presumed
            zeroWidthPoints.push({y: dataPoint0.y, zeroSpan: dX})
        }

        let lastY = dataPoint0.y ?? 0
        let lastX = dataPoint0.x

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