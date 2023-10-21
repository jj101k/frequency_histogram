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
 *
 */
class Scaler {
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
    #preferLog

    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog) {
        this.#field = field
        this.#preferLog = preferLog
    }

    /**
     *
     * @param {number} f
     * @returns
     */
    displayFrequency(f) {
        if(this.#field.expectsExponentialFrequency) {
            // 0 may legitimately appear in the middle of exponential frequency sets
            return -Math.log(f + 0.001)
        } else {
            return -f
        }
    }

    /**
     *
     * @param {number} v
     * @param {number} logOffset
     * @returns
     */
    displayValue(v, logOffset) {
        if(this.#preferLog ?? this.#field.exponentialValues) {
            return Math.log(v + logOffset)
        } else {
            return v
        }
    }

    /**
     *
     * @param {{y: number, f: number}[]} values
     */
    renderValues(values) {

        let trueMinF = this.displayFrequency(values[0].f)
        let trueMaxF = this.displayFrequency(values[0].f)
        for (const d of values) {
            const v = this.displayFrequency(d.f)
            if (v > trueMaxF) {
                trueMaxF = v
            }
            if (v < trueMinF) {
                trueMinF = v
            }
        }

        const logOffset = values[0].y > 0 ? 0 : (1 - values[0].y)
        const minX = this.displayValue(values[0].y, logOffset)
        const maxX = this.displayValue(values[values.length - 1].y, logOffset)

        const rescale = (maxX - minX) / ((trueMaxF - trueMinF) * 4)

        const firstPos = { x: this.displayValue(values[0].y, logOffset), y: this.displayFrequency(values[0].f) * rescale }
        const pathRenderer = new SvgPathRenderer({x: firstPos.x, y: firstPos.y})

        const renderSquare = values.length < Scaler.renderSquareLimit

        // Last point is handled specially.
        const tail = values.pop()

        let lastPos = firstPos
        if (renderSquare) {
            for (const d of values) {
                const v = this.displayFrequency(d.f) * rescale
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: lastPos.y})
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: v})
                lastPos = { x: this.displayValue(d.y, logOffset), y: v }
            }
        } else {
            for (const d of values) {
                const v = this.displayFrequency(d.f) * rescale
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: v})
                lastPos = {x: this.displayValue(d.y, logOffset), y: v}
            }
        }

        // Always a horizontal line to the last point, for symmetry with the first
        if(tail) {
            pathRenderer.line({x: this.displayValue(tail.y, logOffset), y: lastPos.y})
        }

        const box = pathRenderer.box

        return {dA: pathRenderer.dA,
            box: [box.x, box.y, box.w, box.h].join(" "),
            strokeWidth: `${(maxX - minX) / 800}`}
    }
}