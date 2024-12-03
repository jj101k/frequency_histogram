//@ts-check
/**
 * A scaler which will fix the target values in at the supplied scale
 *
 * @abstract
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
 * @extends {ValueScaler<{x: number}>}
 */
class XModulusValueScaler extends ValueScaler {
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