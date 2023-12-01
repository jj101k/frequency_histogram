//@ts-check
/// <reference path="./epwDataFormat.js" />

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
    #compiledPath

    /**
     * @type {string[]}
     */
    #compiledPaths = []

    /**
     *
     */
    #topLeft

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    #fit(pos) {
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
    get compiledPath() {
        return this.#compiledPath
    }

    /**
     *
     */
    get compiledPaths() {
        return [
            ...this.#compiledPaths,
            this.compiledPath
        ]
    }

    /**
     *
     * @param {{x: number, y: number}} firstPos
     */
    constructor(firstPos) {
        this.#compiledPath = this.#newPath(firstPos)
        this.#topLeft = {x: firstPos.x, y: firstPos.y}
        this.#bottomRight = {x: firstPos.x, y: firstPos.y}
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    #newPath(pos) {
        return `M ${pos.x} ${pos.y}`
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    addPathFrom(pos) {
        this.#compiledPaths.push(this.#compiledPath)
        this.#compiledPath = this.#newPath(pos)
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    line(pos) {
        if(Number.isNaN(pos.x) || Number.isNaN(pos.y)) {
            console.error(pos)
            throw new Error("NaN position")
        }
        this.#compiledPath += ` L ${pos.x} ${pos.y}`
        this.#fit(pos)
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    moveTo(pos) {
        if(Number.isNaN(pos.x) || Number.isNaN(pos.y)) {
            console.error(pos)
            throw new Error("NaN position")
        }
        this.#compiledPath += ` M ${pos.x} ${pos.y}`
        this.#fit(pos)
    }
}

/**
 * @template F
 */
class ValueScaler {
    /**
     *
     * @param {F[]} values
     */
    prepare(values) {
    }

    /**
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    scale(d) {
        throw new Error("Not implemented")
    }
}

/**
 * @extends {ValueScaler<{f: number}>}
 */
class FInverseScaler extends ValueScaler {
    /**
     *
     * @param {{f: number}} d
     * @returns {number}
     */
    scale(d) {
        return -d.f
    }
}

/**
 * @extends {ValueScaler<{f: number}>}
 */
class FInverseLogScaler extends ValueScaler {
    /**
     *
     * @param {{f: number}} d
     * @returns {number}
     */
    scale(d) {
        // 0 may legitimately appear in the middle of exponential frequency sets
        return -Math.log(d.f + 0.001)
    }
}

/**
 * @extends {ValueScaler<{x: number}>}
 */
class XLinearScaler extends ValueScaler {
    /**
     *
     * @param {{x: number}} d
     * @returns {number}
     */
    scale(d) {
        return d.x
    }
}

/**
 * @extends {ValueScaler<{x: number}>}
 */
class XModulusScaler extends ValueScaler {
    /**
     *
     */
    #modulus
    /**
     *
     * @param {number} modulus
     */
    constructor(modulus) {
        super()
        this.#modulus = modulus
    }
    /**
     *
     * @param {{x: number}} d
     * @returns {number}
     */
    scale(d) {
        return d.x % this.#modulus
    }
}

/**
 * @extends {ValueScaler<{y: number}>}
 */
class YLinearScaler extends ValueScaler {
    /**
     *
     * @param {{y: number}} d
     * @returns {number}
     */
    scale(d) {
        return d.y
    }
}

/**
 * @extends {ValueScaler<HistogramDatum>}
 */
class YLogScaler extends ValueScaler {
    /**
     *
     */
    #logOffset = 0
    /**
     *
     * @param {HistogramDatum[]} values
     */
    prepare(values) {
        this.#logOffset = values[0].y > 0 ? 0 : (1 - values[0].y)
    }
    /**
     *
     * @param {HistogramDatum} d
     * @returns {number}
     */
    scale(d) {
        return Math.log(d.y + this.#logOffset)
    }
}

/**
 * @template F
 */
class Scaler {
    /**
     * @abstract
     * @type {ValueScaler<F>}
     */
    xScaler

    /**
     * @abstract
     * @type {ValueScaler<F>}
     */
    yScaler

    /**
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayX(d) {
        return this.xScaler.scale(d)
    }

    /**
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayY(d) {
        return this.yScaler.scale(d)
    }

    /**
     * @protected
     *
     * @param {number} minX
     * @param {number} maxX
     * @returns
     */
    getStrokeWidth(minX, maxX) {
        return (maxX - minX) / 800
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

        this.xScaler.prepare(values)
        this.yScaler.prepare(values)
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

        return {compiledPaths: pathRenderer.compiledPaths,
            box: [box.x, box.y, box.w, box.h].join(" "),
            strokeWidth: this.getStrokeWidth(minX, maxX)}
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
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        for (const d of values) {
            const y = this.displayY(d) * rescale
            const x = this.displayX(d)
            pathRenderer.line({ x, y })
            lastPos = { x, y: y }
        }
        return lastPos
    }

    /**
     * @abstract
     * @param {number} x
     * @param {number} y
     * @returns {F}
     */
    valueAt(x, y) {
        throw new Error("Not implemented")
    }
}

/**
 * @typedef {{f: number, y: number}} HistogramDatum
 */

/**
 * @extends {Scaler<HistogramDatum>}
 */
class FrequencyScaler extends Scaler {
    /**
     * Below this limit, points will be rendered correctly for the data (all
     * lines perpendicular); above, it will be rendered in a more representative
     * way for the underlying expectations, as directly connected points.
     */
    static renderSquareLimit = 200

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
    constructor(field, preferLog = undefined) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new YLogScaler() : new YLinearScaler()
        this.yScaler = this.#field.expectsExponentialFrequency ? new FInverseLogScaler() : new FInverseScaler()
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
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        const renderSquare = values.length < FrequencyScaler.renderSquareLimit
        if (renderSquare) {
            for (const d of values) {
                const x = this.displayX(d)
                const y = this.displayY(d) * rescale
                pathRenderer.line({ x, y: lastPos.y })
                pathRenderer.line({ x, y })
                lastPos = { x, y }
            }
        } else {
            for (const d of values) {
                const x = this.displayX(d)
                const y = this.displayY(d) * rescale
                pathRenderer.line({ x, y })
                lastPos = { x, y }
            }
        }
        return lastPos
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {HistogramDatum}
     */
    valueAt(x, y) {
        let y1
        if(this.#preferLog ?? this.#field.exponentialValues) {
            y1 = Math.exp(x) - this.#logOffset
        } else {
            y1 = x
        }
        let f
        if(this.#field.expectsExponentialFrequency) {
            // 0 may legitimately appear in the middle of exponential frequency sets
            f = Math.exp(-y) - 0.001
        } else {
            f = -y
        }
        return {f, y: y1}
    }
}


/**
 * @extends {Scaler<HistogramDatum>}
 */
class HistogramScaler extends Scaler {
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

    getStrokeWidth(minX, maxX) {
        return 1/20
    }

    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new YLogScaler() : new YLinearScaler()
        this.yScaler = this.#field.expectsExponentialFrequency ? new FInverseLogScaler() : new FInverseScaler()
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
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        // These are always discrete
        for (const d of values) {
            const x = this.displayX(d)
            const y = this.displayY(d) * rescale
            pathRenderer.addPathFrom({x, y: 0})
            pathRenderer.line({ x, y })
            lastPos = { x, y }
        }
        return lastPos
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {HistogramDatum}
     */
    valueAt(x, y) {
        let y1
        if(this.#preferLog ?? this.#field.exponentialValues) {
            y1 = Math.exp(x) - this.#logOffset
        } else {
            y1 = x
        }
        let f
        if(this.#field.expectsExponentialFrequency) {
            // 0 may legitimately appear in the middle of exponential frequency sets
            f = Math.exp(-y) - 0.001
        } else {
            f = -y
        }
        return {f, y: y1}
    }
}


/**
 * @typedef {{x: number, y: number}} RawDatum
 */

/**
 * @extends {Scaler<RawDatum>}
 */
class RawScaler extends Scaler {
    xScaler = new XLinearScaler()
    yScaler = new YLinearScaler()

    /**
     * @param {number} x
     * @param {number} y
     * @returns {RawDatum}
     */
    valueAt(x, y) {
        return {x, y}
    }
}

/**
 * @extends {RawScaler}
 */
class RawScalerOverlap extends RawScaler {
    xScaler = new XModulusScaler(24)

    /**
     *
     * @param {RawDatum[]} values
     * @param {number} rescale
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, rescale, pathRenderer, firstPos) {
        let lastPos = firstPos
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        for (const d of values) {
            const x = this.displayX(d)
            const y = this.displayY(d) * rescale
            if(x < lastPos.x) {
                pathRenderer.addPathFrom({x, y})
            }
            pathRenderer.line({ x, y })
            lastPos = { x, y }
        }
        return lastPos
    }
}