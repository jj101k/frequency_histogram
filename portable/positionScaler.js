/// <reference path="valueScaler.js" />
/// <reference path="types.d.ts" />

/**
 * @abstract
 * @template F
 */
class PositionScaler {
    /**
     * @abstract
     * @protected
     * @type {ValueScaler<F>}
     */
    xScaler

    /**
     * @abstract
     * @protected
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
     *
     * @param {F[]} values
     * @returns
     */
    prepareXScaler(values) {
        return this.xScaler.prepare(values)
    }

    /**
     *
     * @param {F[]} values
     * @param {number} [scaleTo]
     * @returns
     */
    prepareYScaler(values, scaleTo) {
        return this.yScaler.prepare(values, scaleTo)
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
 * @extends {PositionScaler<HistogramDatum>}
 */
class FrequencyPositionScaler extends PositionScaler {
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
     * @param {valueConfiguration} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog = undefined) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new YLogValueScaler() : new YLinearValueScaler()
        this.yScaler = this.#field.expectsExponentialFrequency ? new FInverseLogValueScaler() : new FInverseValueScaler()
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
 * @extends {PositionScaler<HistogramDatum>}
 */
class HistogramPositionScaler extends PositionScaler {
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
     * @param {{exponentialValues?: boolean, expectsExponentialFrequency?: boolean, isScalar?: boolean}} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        if(this.#field.isScalar) {
            this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new YLogValueScaler() : new YLinearValueScaler()
        } else {
            this.xScaler = new YStaticValueScaler()
        }
        this.yScaler = this.#field.expectsExponentialFrequency ? new FInverseLogValueScaler() : new FInverseValueScaler()
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
 * This just maps the input values to themselves
 *
 * @extends {PositionScaler<RawDatum>}
 */
class RawPositionScaler extends PositionScaler {
    xScaler = new XLinearValueScaler()
    yScaler = new YLinearValueScaler()

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
 * This maps the input values to themselves except that x is modulo 24.
 *
 * @extends {RawPositionScaler}
 */
class RawPositionScalerOverlap extends RawPositionScaler {
    xScaler = new XModulusValueScaler(24)
}