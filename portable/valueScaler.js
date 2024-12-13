/**
 * A scaler which will fit the target values in at the supplied scale
 *
 * @abstract
 */
class ValueScaler {
    /**
     * @protected If set, this will multiply the values
     */
    scaleFactor = 1

    /**
     * @protected
     *
     * @param {number[]} values
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
     * @param {number[]} values
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
     * @param {number[]} values
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
     * @param {number} d
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
 * @extends {ValueScaler}
 */
class InverseValueScaler extends ValueScaler {
    /**
     *
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        return -d * this.scaleFactor
    }
}

/**
 * Produces the log of the value. This doesn't support negative numbers, but
 * does support 0 as a special case.
 *
 * This might be used where the data is normally exponential.
 *
 * @extends {ValueScaler}
 */
class InverseLogValueScaler extends ValueScaler {
    /**
     *
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        // 0 may legitimately appear in the middle of exponential frequency sets
        return -Math.log(d + 1) * this.scaleFactor
    }
}

/**
 * @extends {ValueScaler}
 */
class LinearValueScaler extends ValueScaler {
    /**
     *
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        return d * this.scaleFactor
    }
}

/**
 * This keeps the value in the range 0 <= value < modulus.
 * This would produce a folded graph and is expected to be used to describe 24 hours.
 *
 * This only operates correctly on integers.
 *
 * @extends {ValueScaler}
 */
class ModulusValueScaler extends ValueScaler {
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
     * @param {number[]} values
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
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        return d % this.#modulus * this.scaleFactor
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
 * @extends {ValueScaler}
 */
class LogValueScaler extends ValueScaler {
    /**
     *
     */
    #logOffset = 0
    /**
     *
     * @param {number[]} values
     * @param {number} [scaleTo]
     */
    prepare(values, scaleTo) {
        this.#logOffset = values[0] > 0 ? 0 : (1 - values[0])
        return this.prepareScale(values, scaleTo)
    }
    /**
     *
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        return Math.log(d + this.#logOffset) * this.scaleFactor
    }
}

/**
 * @extends {ValueScaler}
 *
 * This considers the value, but practically just steps up by 1 whenever it
 * changes. This is used for non-scalar data, eg. discrete states encoded in a
 * number.
 */
class StaticValueScaler extends ValueScaler {
    reset() {
        this.#value = 1
    }
    /**
     *
     */
    #value = 1
    /**
     * @type {number | undefined}
     *
     * The literal value from the last iteration
     */
    #lastStoredValue
    valueRange(values) {
        return {min: 0, max: values.length - 1}
    }
    /**
     *
     * @param {number} d
     * @returns {number}
     */
    scale(d) {
        if(this.#lastStoredValue === undefined) {
            this.#lastStoredValue = d
        } else if(d != this.#lastStoredValue) {
            this.#value++
        }
        return this.#value * this.scaleFactor
    }
}