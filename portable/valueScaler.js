/**
 * A scaler which will fit the target values in at the supplied scale
 *
 * @abstract
 * @template F
 */
class ValueScaler {
    /**
     * @protected If set, this will multiply the values
     */
    scaleFactor = 1

    /**
     * @protected
     *
     * @param {F[]} values
     * @param {number} [scaleTo] If set, the range size will be adjusted such
     * that max-min is scaleTo.
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
     * @returns {{min: number, max: number}} The current (scaled) value range.
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
     * Scales a single value
     *
     * @param {F} d
     * @returns {number}
     */
    scale(d) {
        throw new Error("Not implemented")
    }
}

/**
 * Emits the negative form of the value. This might be used for rendering where
 * the natural presentation may be upside-down.
 *
 * This operates on the frequency (f).
 *
 * @extends {ValueScaler<{f: number}>}
 */
class FInverseValueScaler extends ValueScaler {
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
 * Produces the log of the value. This doesn't support negative numbers, but
 * does support 0 as a special case.
 *
 * This might be used where the data is normally exponential.
 *
 * This operates on the frequency (f).
 *
 * @extends {ValueScaler<{f: number}>}
 */
class FInverseLogValueScaler extends ValueScaler {
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
 * This operates on the value (x).
 *
 * @extends {ValueScaler<{x: number}>}
 */
class XLinearValueScaler extends ValueScaler {
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
 * This operates on the value (x), but keeps it in the range 0 <= x < modulus.
 * This would produce a folded graph and is expected to be used to describe 24 hours.
 *
 * This only operates correctly on integers.
 *
 * @extends {ValueScaler<{x: number}>}
 */
class XModulusValueScaler extends ValueScaler {
    /**
     *
     */
    #modulus

    /**
     * @protected
     *
     * As a special exception, this emits what the range would be, regardless of
     * what the values are.
     *
     * @param {{x: number}[]} values
     * @returns
     */
    valueRange(values) {
        return {min: 0, max: this.#modulus - 1}
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
 * This operates on the value (y).
 *
 * @extends {ValueScaler<{y: number}>}
 */
class YLinearValueScaler extends ValueScaler {
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
 * Produces the log of the value. If the first value is nonpositive, this will
 * be offset against that value, eg. if you have a first value of -3 the offset
 * will be 4. This is only used to adjust the base for the logarithm operation,
 * and the output will still be of the expected scale range.
 *
 * This might be used where the data is normally exponential.
 *
 * This operates on the value (y).
 *
 * @extends {ValueScaler<HistogramDatum>}
 */
class YLogValueScaler extends ValueScaler {
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
 *
 * This considers the value (y), but practically just steps up by 1 whenever y
 * changes (increases). This is used for non-scalar data, eg. discrete states
 * encoded in a number.
 */
class YStaticValueScaler extends ValueScaler {
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