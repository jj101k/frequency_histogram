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
     *
     */
    #field

    /**
     *
     * @param {EpwNamedNumberField} field
     */
    constructor(field) {
        this.#field = field
    }

    /**
     *
     * @param {number} f
     * @returns
     */
    displayFrequency(f) {
        if(this.#field.expectsExponentialFrequency) {
            return -Math.log(f)
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
        if(this.#field.exponentialValues) {
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
        const firstPos = {y: values[0].y - 0.1, fV: 0}
        const logOffset = firstPos.y > 0 ? 0 : (1 - firstPos.y)
        const minX = this.displayValue(values[0].y, logOffset)
        const maxX = this.displayValue(values[values.length - 1].y, logOffset)

        const pathRenderer = new SvgPathRenderer({x: this.displayValue(firstPos.y, logOffset), y: firstPos.fV})

        let trueMinY = values[0].f
        let trueMaxY = values[0].f
        for (const d of values) {
            const v = this.displayFrequency(d.f)
            if (v > trueMaxY) {
                trueMaxY = v
            }
            if (v < trueMinY) {
                trueMinY = v
            }
        }

        const renderSquare = values.length < 20

        const rescale = (maxX - minX) / ((trueMaxY - trueMinY) * 4)

        if (renderSquare) {
            let lastPos = firstPos
            for (const d of values) {
                const v = this.displayFrequency(d.f) * rescale
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: lastPos.fV})
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: v})
                lastPos = { y: this.displayValue(d.y, logOffset), fV: v }
            }
        } else {
            for (const d of values) {
                const v = this.displayFrequency(d.f) * rescale
                pathRenderer.line({x: this.displayValue(d.y, logOffset), y: v})
            }
        }

        const box = pathRenderer.box

        return {dA: pathRenderer.dA,
            box: [box.x, box.y, box.w, box.h].join(" "),
            strokeWidth: `${(maxX - minX) / 800}`}
    }
}