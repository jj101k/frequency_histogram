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
     */
    #logOffset

    /**
     *
     */
    #pathRenderer

    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {{y: number, fV: number}} firstPos
     */
    constructor(field, firstPos) {
        this.#field = field
        this.#logOffset = firstPos.y > 0 ? 0 : (1 - firstPos.y)

        this.#pathRenderer = new SvgPathRenderer({x: this.displayValue(firstPos.y), y: firstPos.fV})
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
     * @returns
     */
    displayValue(v) {
        if(this.#field.exponentialValues) {
            return Math.log(v + this.#logOffset)
        } else {
            return v
        }
    }

    /**
     *
     * @param {{y: number, f: number}[]} values
     * @param {{y: number, fV: number}} firstPos
     */
    test3(values, firstPos) {
        const minX = this.displayValue(values[0].y)
        const maxX = this.displayValue(values[values.length - 1].y)

        let trueMinY = 0
        let trueMaxY = 0
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
                this.#pathRenderer.line({x: this.displayValue(d.y), y: lastPos.fV})
                this.#pathRenderer.line({x: this.displayValue(d.y), y: v})
                lastPos = { y: this.displayValue(d.y), fV: v }
            }
        } else {
            for (const d of values) {
                const v = this.displayFrequency(d.f) * rescale
                this.#pathRenderer.line({x: this.displayValue(d.y), y: v})
            }
        }

        const box = this.#pathRenderer.box

        return {dA: this.#pathRenderer.dA,
            box: [box.x, box.y, box.w, box.h].join(" "), maxX, minX}
    }
}