//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./epwParser.js" />

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
    #addZeroPointFull() {
        const zeroPoint = this.#nextZeroPoint
        if(!zeroPoint) {
            throw new Error("Internal error")
        }
        /**
         * @type {number}
         */
        let nextY
        // The current span point(s) are either EQUAL or GREATER.
        /**
         * @type {number[]}
         */
        const possibleNextY = []
        if (this.#nextSpanPoint && this.#nextSpanPoint.y > zeroPoint.y) {
            possibleNextY.push(this.#nextSpanPoint.y)
        } else if (this.#spanPoints.length) {
            possibleNextY.push(this.#spanPoints[0].y)
        }
        if (this.#zeroWidthPoints.length) {
            possibleNextY.push(this.#zeroWidthPoints[0].y)
        }
        if(possibleNextY.length) {
            nextY = Math.min(...possibleNextY)
        } else if(this.#lastY) {
            nextY = zeroPoint.y + (zeroPoint.y - this.#lastY)
        } else {
            // This is an estimate!
            nextY = zeroPoint.y + this.#zeroDeltaSpan
        }
        const nextLastY = zeroPoint.y
        // Estimate if needed
        const lastY = this.#lastY ?? (zeroPoint.y - (nextY - zeroPoint.y))
        const [lowZeroPoint, highZeroPoint] = [
            {y: (lastY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (nextY - lastY)},
            {y: (nextY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (nextY - lastY)},
        ]
        // Now we have the answer we can push the "before" value
        this.#addDeltas(lowZeroPoint)
        // Then the equal value, if applicable.
        if (this.#nextSpanPoint && this.#nextSpanPoint.y == zeroPoint.y) {
            this.#addNextSpanPoint()
        }
        // Then the "after" value.
        this.#addDeltas(highZeroPoint)
        this.#getNextZeroPoint()
        this.#lastY = nextLastY
    }

    /**
     *
     */
    #getNextSpanPoint() {
        this.#nextSpanPoint = this.#shiftSpanPoints()
    }

    /**
     *
     */
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
            while(this.#nextSpanPoint && this.#nextSpanPoint.y < this.#nextZeroPoint.y) {
                // If the span points are early, we can just push them.
                if(this.#lastY === undefined || this.#lastY != this.#nextSpanPoint.y) {
                    this.#lastY = this.#nextSpanPoint.y
                }
                this.#addNextSpanPoint()
            }
            this.#addZeroPointFull()
        }

        // If there are non-zeroes left, just push them.
        const spanPoints = this.#spanPoints
        this.#spanPoints = []
        this.#addNextSpanPoint()
        this.#addDeltas(...spanPoints)

        // If there are zeroes left, follow a tighter loop.
        while(this.#nextZeroPoint) {
            this.#addZeroPointFull()
        }

        return {combinedDeltas: this.#combinedDeltas, zeroDeltaSpan: this.#zeroDeltaSpan}
    }
}

/**
 * This is similar but uses a whitelist of sensor points instead.
 */
class HistogramDeltasNoiseReduced {
    /**
     * @type {{y: number, dF: number}[]}
     */
    #combinedDeltas = []
    /**
     * @type {{y: number, dF: number} | null}
     */
    #nextSpanPoint = null
    /**
     * @type {number | null}
     */
    #nextWhitelistPoint = null
    /**
     * @type {{y: number, zeroSpan: number} | null}
     */
    #nextZeroPoint = null
    /**
     *
     */
    #sensorPointWhitelist
    /**
     *
     */
    #spanPoints
    /**
     * @type {{y: number, dF: number}[]}
     */
    #zeroDeltas = []
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
     * @param {{y: number, dF: number}[]} values
     */
    #addZeroDeltas(...values) {
        if(!values.length) {
            return 0
        }
        let vL = this.#zeroDeltas[this.#zeroDeltas.length - 1]
        let added = 0
        if(!vL) {
            vL = values[0]
            values.shift()
            this.#zeroDeltas.push(vL)
            added++
        }
        for(const v of values) {
            if(v.y == vL.y) {
                vL.dF += v.dF
            } else {
                this.#zeroDeltas.push(v)
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
    #addZeroPointFull() {
        const zeroPoint = this.#nextZeroPoint
        if(!zeroPoint) {
            throw new Error("Internal error")
        }
        // We want:
        // 1. The last whitelist point _before_ this
        // 2. The whitelist point on this, if applicable - for next time
        // 3. The whitelist point after this.

        let whitelistPointBefore = this.#nextWhitelistPoint
        if(!whitelistPointBefore) {
            throw new Error()
        }

        // Suck up until the next point is after.
        while(this.#sensorPointWhitelist.length && this.#sensorPointWhitelist[0] <= zeroPoint.y) {
            this.#getNextWhitelistPoint()
            if(this.#nextWhitelistPoint !== null && this.#nextWhitelistPoint < zeroPoint.y) {
                whitelistPointBefore = this.#nextWhitelistPoint
            }
        }

        const lastY = whitelistPointBefore
        const nextY = this.#sensorPointWhitelist.length ? this.#sensorPointWhitelist[0] : (zeroPoint.y + (zeroPoint.y - lastY))

        const [lowZeroPoint, highZeroPoint] = [
            {y: (lastY + zeroPoint.y) / 2, dF: zeroPoint.zeroSpan / (nextY - lastY)},
            {y: (nextY + zeroPoint.y) / 2, dF: -zeroPoint.zeroSpan / (nextY - lastY)},
        ]
        // Now we have the answer we can push the values
        this.#zeroDeltas.push(lowZeroPoint, highZeroPoint)
        this.#getNextZeroPoint()
    }

    /**
     *
     */
    #getNextSpanPoint() {
        this.#nextSpanPoint = this.#shiftSpanPoints()
    }

    /**
     *
     */
    #getNextWhitelistPoint() {
        this.#nextWhitelistPoint = this.#shiftWhitelistPoints()
    }

    /**
     *
     */
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
    #shiftWhitelistPoints() {
        return this.#sensorPointWhitelist.shift() ?? null
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
     * @param {{y: number, dF: number}[]} deltas
     * @param {number} zeroDeltaSpan
     * @param {{y: number, zeroSpan: number}[]} zeroWidthPoints
     * @param {number[]} sensorPointWhitelist
     */
    constructor(deltas, zeroDeltaSpan, zeroWidthPoints, sensorPointWhitelist) {
        this.#spanPoints = deltas
        this.#zeroDeltaSpan = zeroDeltaSpan
        this.#zeroWidthPoints = zeroWidthPoints
        this.#sensorPointWhitelist = sensorPointWhitelist
        console.log("Initial points", sensorPointWhitelist)
        this.#getNextZeroPoint()
        this.#getNextSpanPoint()
        this.#getNextWhitelistPoint()
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        // We do _two_ passes here:
        // One for the zero points -> temp

        while(this.#nextZeroPoint) {
            this.#addZeroPointFull()
        }

        this.#zeroDeltas.sort((a, b) => a.y - b.y)

        // Then one for the nonzero points + <- temp

        while(this.#nextSpanPoint) {
            const nsp = this.#nextSpanPoint
            const i = this.#zeroDeltas.findIndex(d => d.y > nsp.y)
            if(i < 0) {
                this.#addDeltas(...this.#zeroDeltas)
                this.#zeroDeltas = []
            } else {
                this.#addDeltas(...this.#zeroDeltas.slice(0, i))
                this.#zeroDeltas = this.#zeroDeltas.slice(i)
            }
            this.#addNextSpanPoint()
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
     * @type {((value: EpwRow) => boolean) | undefined}
     */
    #filter

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
    #noiseReduction = false

    /**
     *
     */
    #parser

    /**
     *
     */
    #raw = false

    /**
     *
     * @param {{y: number, f: number}[]} orderedFrequenciesReal
     * @returns
     */
    #getAcceptedValues(orderedFrequenciesReal) {
        /**
         * @type {Set<number>}
         */
        const acceptedValues = new Set()
        let last = orderedFrequenciesReal[0]
        acceptedValues.add(last.y)
        for (const v of orderedFrequenciesReal.slice(1)) {
            if (10 * v.f / last.f > 2) {
                last = v
                acceptedValues.add(v.y)
            }
        }
        return acceptedValues
    }

    /**
     *
     * @param {{x: number, y: number}[]} dataPoints
     * @returns
     */
    #getOrderedFrequencies(dataPoints) {
        /**
         * @type {Record<number, number>}
         */
        const frequencies = {}
        for (const dataPoint of dataPoints) {
            if (dataPoint.y === undefined || dataPoint.y === null) {
                continue
            }
            if (!frequencies[dataPoint.y]) {
                frequencies[dataPoint.y] = 0
            }
            frequencies[dataPoint.y]++
        }
        const orderedFrequenciesReal = Object.entries(frequencies).map(([y, f]) => ({ y: +y, f })).sort((a, b) => a.y - b.y)
        return orderedFrequenciesReal
    }

    /**
     * This provides the deltas with all values with the same y value combined.
     */
    get combined() {
        if(!this.#deltaInfo) {
            this.#deltaInfo = this.getDeltas()
        }
        if(this.#noiseReduction) {
            return new HistogramDeltasNoiseReduced(this.#deltaInfo.deltas, this.#deltaInfo.zeroDeltaSpan, this.#deltaInfo.zeroWidthPoints,
                [...this.#getAcceptedValues(this.#getOrderedFrequencies(this.rawValues))]).combined

        } else {
            return new HistogramDeltas(this.#deltaInfo.deltas, this.#deltaInfo.zeroDeltaSpan, this.#deltaInfo.zeroWidthPoints).combined
        }
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

    /**
     *
     */
    get expectedMinDeltaY() {
        let expectedMinDeltaY = this.#fieldInfo.expectedMinResolution
        if(expectedMinDeltaY === undefined) {
            const dataPoints = this.rawValues
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

        return expectedMinDeltaY
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
    get filter() {
        return this.#filter
    }
    set filter(v) {
        this.#filter = v
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
     */
    get noiseReduction() {
        return this.#noiseReduction
    }
    set noiseReduction(v) {
        this.#noiseReduction = v
        this.#deltaInfo = undefined
        this.#frequencies = undefined
    }

    /**
     *
     */
    get rawValues() {
        return this.#parser.getValues(this.#fieldInfo.field, this.#limit, this.#filter)
    }

    /**
     *
     * @returns
     */
    getDeltas() {
        const dataPoints = this.rawValues

        // Special case: exactly one point
        if(dataPoints.length == 1) {
            return {deltas: [], zeroDeltaSpan: this.#fieldInfo.expectedMinResolution ?? 1,
                zeroWidthPoints: [{y: dataPoints[0].y, zeroSpan: 1}]}
        }

        // This will be a fraction, so we'll try to get a good decimal
        // representation for sanity's sake.
        const decimalDigits = 10
        const nominalZeroDeltaSpan = this.expectedMinDeltaY / 2
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
     * @param {EpwNamedNumberField} field
     * @param {boolean} noiseReduction
     * @returns
     */
    getFrequencies(field = this.#fieldInfo.field, noiseReduction = this.#noiseReduction) {
        const dataPoints = this.#parser.getValues(field, this.#limit, this.#filter)

        const expectedMinDeltaY = this.expectedMinDeltaY

        const orderedFrequenciesReal = this.#getOrderedFrequencies(dataPoints)

        /**
         * @type {typeof orderedFrequenciesReal}
         */
        let orderedFrequencies
        if(noiseReduction) {
            const acceptedValues = this.#getAcceptedValues(orderedFrequenciesReal)

            orderedFrequencies = orderedFrequenciesReal.filter(v => acceptedValues.has(v.y))
        } else {
            orderedFrequencies = orderedFrequenciesReal
        }

        /**
         * @type {typeof orderedFrequencies}
         */
        const filledFrequencies = []
        for(const [i, frequency] of Object.entries(orderedFrequencies)) {
            filledFrequencies.push(frequency)
            if(!orderedFrequencies[+i+1]) break
            const nextY = orderedFrequencies[+i+1].y
            let thisY = frequency.y
            while(thisY + expectedMinDeltaY < nextY) {
                thisY += expectedMinDeltaY
                filledFrequencies.push({y: thisY, f: 0})
            }
        }

        return filledFrequencies
    }

    /**
     *
     * @param {(EpwNamedField<string> | EpwNamedField<number | null>)[]} fields
     * @returns
     */
    getUniqueValues(fields) {
        const dataPoints = this.#parser.getValueMulti(fields)

        /**
         * @type {Map<number | string, (number | string | null | undefined)[]>}
         */
        const unique = new Map()
        const stringify = (fields.length == 1) ? vs => vs[0] : vs => JSON.stringify(vs)
        for(const dataPoint of dataPoints) {
            const s = stringify(dataPoint)
            if(!unique.has(s)) {
                unique.set(s, dataPoint)
            }
        }
        return [...unique.values()]
    }

    /**
     *
     * @param {EpwParser} parser
     */
    constructor(parser) {
        this.#parser = parser
    }
}