//@ts-check
/// <reference path="./epwDataFormat.js" />

/**
 * @template F
 */
class ValueScaler {
    /**
     * @protected
     */
    scaleFactor = 1

    /**
     * @protected
     *
     * @param {F[]} values
     * @param {number} [scaleTo]
     */
    prepareScale(values, scaleTo) {
        const {min, max} = this.valueRange(values)
        const scale = max - min
        if(scaleTo !== undefined) {
            this.scaleFactor = scaleTo / scale
        }
        return scale
    }

    /**
     * @protected
     *
     * If there's any state which was set (particularly during preparation),
     * this resets it.
     */
    reset() {
    }

    /**
     * @protected
     *
     * @param {F[]} values
     * @returns {{min: number, max: number}}
     */
    valueRange(values) {
        let min = Infinity
        let max = -Infinity
        for(const v of values) {
            const d = this.scale(v)
            if(d > max) {
                max = d
            }
            if(d < min) {
                min = d
            }
        }
        this.reset()
        return {min, max}
    }

    /**
     *
     * @param {F[]} values
     * @param {number} [scaleTo]
     * @returns {number}
     */
    prepare(values, scaleTo) {
        return this.prepareScale(values, scaleTo)
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
        return -d.f * this.scaleFactor
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
        return -Math.log(d.f + 1) * this.scaleFactor
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
        return d.x * this.scaleFactor
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
    valueRange(values) {
        return {min: 0, max: 23}
    }
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
        return d.x % this.#modulus * this.scaleFactor
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
        return d.y * this.scaleFactor
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
     * @param {number} [scaleTo]
     */
    prepare(values, scaleTo) {
        this.#logOffset = values[0].y > 0 ? 0 : (1 - values[0].y)
        return this.prepareScale(values, scaleTo)
    }
    /**
     *
     * @param {HistogramDatum} d
     * @returns {number}
     */
    scale(d) {
        return Math.log(d.y + this.#logOffset) * this.scaleFactor
    }
}

/**
 * @extends {ValueScaler<{y: number}>}
 */
class YStaticScaler extends ValueScaler {
    reset() {
        this.#value = 1
    }
    /**
     *
     */
    #value = 1
    /**
     * @type {number | undefined}
     */
    #lastY
    valueRange(values) {
        return {min: 0, max: values.length - 1}
    }
    /**
     *
     * @param {{y: number}} d
     * @returns {number}
     */
    scale(d) {
        if(this.#lastY === undefined) {
            this.#lastY = d.y
        } else if(d.y > this.#lastY) {
            this.#value++
        }
        return this.#value * this.scaleFactor
    }
}

/**
 * @abstract
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
            f = Math.exp(-y) - 1
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

    /**
     *
     * @param {EpwNamedNumberField} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        if(this.#field.isScalar) {
            this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new YLogScaler() : new YLinearScaler()
        } else {
            this.xScaler = new YStaticScaler()
        }
        this.yScaler = this.#field.expectsExponentialFrequency ? new FInverseLogScaler() : new FInverseScaler()
    }

    /**
     *
     * @param {HistogramDatum[]} values
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, pathRenderer, firstPos) {
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        // These are always discrete
        for (const d of values) {
            const x = this.displayX(d)
            const y = this.displayY(d)
            pathRenderer.addPathFrom({x, y: this.yScaler.scale({f: 0})})
            pathRenderer.line({ x, y })
        }

        return ((this.displayX(values[values.length - 1]) - firstPos.x) / values.length) * 0.8 // Not quite full
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
            f = Math.exp(-y) - 1
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
}