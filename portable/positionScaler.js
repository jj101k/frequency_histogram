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
     * @type {ValueScaler}
     */
    xScaler

    /**
     * @abstract
     * @protected
     * @type {ValueScaler}
     */
    yScaler

    /**
     * @protected
     * @abstract
     *
     * @param {F} datum
     * @returns {number}
     */
    xMapper(datum) {
        throw new Error("Not implemented")
    }

    /**
     * @protected
     * @abstract
     *
     * @param {F} datum
     * @returns {number}
     */
    yMapper(datum) {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayX(d) {
        return this.xScaler.scale(this.xMapper(d))
    }

    /**
     * @abstract
     *
     * @param {F} d
     * @returns {number}
     */
    displayY(d) {
        return this.yScaler.scale(this.yMapper(d))
    }

    /**
     *
     * @param {F[]} values
     * @returns
     */
    prepareXScaler(values) {
        return this.xScaler.prepare(values.map(v => this.xMapper(v)))
    }

    /**
     *
     * @param {F[]} values
     * @param {number} [scaleTo]
     * @returns
     */
    prepareYScaler(values, scaleTo) {
        return this.yScaler.prepare(values.map(v => this.yMapper(v)), scaleTo)
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
     * @protected
     *
     * @param {HistogramDatum} datum
     * @returns
     */
    xMapper(datum) {
        return datum.y
    }

    /**
     * @protected
     *
     * @param {HistogramDatum} datum
     * @returns
     */
    yMapper(datum) {
        return datum.f
    }

    /**
     *
     * @param {valueConfiguration} field
     * @param {boolean | undefined} preferLog
     */
    constructor(field, preferLog = undefined) {
        super()
        this.#field = field
        this.#preferLog = preferLog
        this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new LogValueScaler() : new LinearValueScaler()
        this.yScaler = this.#field.expectsExponentialFrequency ? new InverseLogValueScaler() : new InverseValueScaler()
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
     * @protected
     *
     * @param {HistogramDatum} datum
     * @returns
     */
    xMapper(datum) {
        return datum.y
    }

    /**
     * @protected
     *
     * @param {HistogramDatum} datum
     * @returns
     */
    yMapper(datum) {
        return datum.f
    }

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
            this.xScaler = this.#preferLog ?? this.#field.exponentialValues ? new LogValueScaler() : new LinearValueScaler()
        } else {
            this.xScaler = new StaticValueScaler()
        }
        this.yScaler = this.#field.expectsExponentialFrequency ? new InverseLogValueScaler() : new InverseValueScaler()
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
    xScaler = new LinearValueScaler()
    yScaler = new LinearValueScaler()

    /**
     * @protected
     *
     * @param {RawDatum} datum
     * @returns
     */
    xMapper(datum) {
        return datum.x
    }

    /**
     * @protected
     *
     * @param {RawDatum} datum
     * @returns
     */
    yMapper(datum) {
        return datum.y
    }

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
    xScaler = new ModulusValueScaler(24)
}