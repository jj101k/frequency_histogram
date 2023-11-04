//@ts-check

/**
 *
 */
class SvgPathRenderer {
    /**
     *
     */
    #bottomRight

    /**
     *
     */
    #dA

    /**
     *
     */
    #topLeft

    /**
     *
     */
    get box() {
        return {
            x: this.#topLeft.x,
            y: this.#topLeft.y,
            w: this.#bottomRight.x - this.#topLeft.x,
            h: this.#bottomRight.y - this.#topLeft.y,
        }
    }

    /**
     *
     */
    get dA() {
        return this.#dA
    }

    /**
     *
     * @param {{x: number, y: number}} firstPos
     */
    constructor(firstPos) {
        this.#dA = `M ${firstPos.x} ${firstPos.y}`
        this.#topLeft = {x: firstPos.x, y: firstPos.y}
        this.#bottomRight = {x: firstPos.x, y: firstPos.y}
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    line(pos) {
        this.#dA += ` L ${pos.x} ${pos.y}`
        if(pos.x < this.#topLeft.x) {
            this.#topLeft.x = pos.x
        }
        if(pos.x > this.#bottomRight.x) {
            this.#bottomRight.x = pos.x
        }
        if(pos.y < this.#topLeft.y) {
            this.#topLeft.y = pos.y
        }
        if(pos.y > this.#bottomRight.y) {
            this.#bottomRight.y = pos.y
        }
    }
}

/**
 * @template F
 */
class Scaler {
    /**
     * @protected
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayX(d) {
        throw new Error("Not implemented")
    }

    /**
     * @protected
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayY(d) {
        throw new Error("Not implemented")
    }

    /**
     * @protected
     *
     * @param {F[]} values
     */
    prepare(values) {
    }

    /**
     *
     * @param {F[]} values
     */
    renderValues(values) {
        let trueMinF = this.displayY(values[0])
        let trueMaxF = this.displayY(values[0])
        for (const d of values) {
            const v = this.displayY(d)
            if (v > trueMaxF) {
                trueMaxF = v
            }
            if (v < trueMinF) {
                trueMinF = v
            }
        }

        this.prepare(values)

        const minX = this.displayX(values[0])
        const maxX = this.displayX(values[values.length - 1])

        const rescale = (maxX - minX) / ((trueMaxF - trueMinF) * 4)

        const firstPos = { x: this.displayX(values[0]), y: this.displayY(values[0]) * rescale }
        const pathRenderer = new SvgPathRenderer({x: firstPos.x, y: firstPos.y})

        // Last point is handled specially.
        const tail = values.pop()

        const lastPos = this.renderValuePoints(values, rescale, pathRenderer, firstPos)

        // Always a horizontal line to the last point, for symmetry with the first
        if(tail) {
            pathRenderer.line({x: this.displayX(tail), y: lastPos.y})
        }

        const box = pathRenderer.box

        return {dA: pathRenderer.dA,
            box: [box.x, box.y, box.w, box.h].join(" "),
            strokeWidth: `${(maxX - minX) / 800}`}
    }

    /**
     *
     * @param {F[]} values
     * @param {number} rescale
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, rescale, pathRenderer, firstPos) {
        let lastPos = firstPos
        for (const d of values) {
            const v = this.displayY(d) * rescale
            pathRenderer.line({ x: this.displayX(d), y: v })
            lastPos = { x: this.displayX(d), y: v }
        }
        return lastPos
    }
}

/**
 * @typedef {{f: number, y: number}} HistogramDatum
 */

/**
 * @extends {Scaler<HistogramDatum>}
 */
class HistogramScaler extends Scaler {
    /**
     * Below this limit, points will be rendered correctly for the data (all
     * lines perpendicular); above, it will be rendered in a more representative
     * way for the underlying expectations, as directly connected points.
     */
    static renderSquareLimit = 50

    /**
     *
     */
    #field

    /**
     *
     */
    #logOffset = 0

    /**
     *
     */
    #preferLog

    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog) {
        super()
        this.#field = field
        this.#preferLog = preferLog
    }

    /**
     * @protected
     *
     * @param {HistogramDatum} d
     * @returns
     */
    displayX(d) {
        if(this.#preferLog ?? this.#field.exponentialValues) {
            return Math.log(d.y + this.#logOffset)
        } else {
            return d.y
        }
    }

    /**
     * @protected
     *
     * @param {HistogramDatum} d
     * @returns
     */
    displayY(d) {
        if(this.#field.expectsExponentialFrequency) {
            // 0 may legitimately appear in the middle of exponential frequency sets
            return -Math.log(d.f + 0.001)
        } else {
            return -d.f
        }
    }

    /**
     * @protected
     *
     * @param {HistogramDatum[]} values
     */
    prepare(values) {
        this.#logOffset = values[0].y > 0 ? 0 : (1 - values[0].y)
    }

    /**
     *
     * @param {HistogramDatum[]} values
     * @param {number} rescale
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, rescale, pathRenderer, firstPos) {
        let lastPos = firstPos
        const renderSquare = values.length < HistogramScaler.renderSquareLimit
        if (renderSquare) {
            for (const d of values) {
                const v = this.displayY(d) * rescale
                pathRenderer.line({ x: this.displayX(d), y: lastPos.y })
                pathRenderer.line({ x: this.displayX(d), y: v })
                lastPos = { x: this.displayX(d), y: v }
            }
        } else {
            for (const d of values) {
                const v = this.displayY(d) * rescale
                pathRenderer.line({ x: this.displayX(d), y: v })
                lastPos = { x: this.displayX(d), y: v }
            }
        }
        return lastPos
    }
}


/**
 * @typedef {{x: number, y: number}} RawDatum
 */

/**
 * @extends {Scaler<RawDatum>}
 */
class RawScaler extends Scaler {
    /**
     * @protected
     *
     * @param {RawDatum} d
     * @returns
     */
    displayX(d) {
        return d.x
    }

    /**
     * @protected
     *
     * @param {RawDatum} d
     * @returns
     */
    displayY(d) {
        return d.y
    }
}