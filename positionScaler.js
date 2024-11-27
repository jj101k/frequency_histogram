//@ts-check
/// <reference path="./epwDataFormat.js" />
/// <reference path="./valueScaler.js" />

/**
 * @abstract
 * @template F
 */
class PositionScaler {
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
     * @param {EpwNamedNumberField} field
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
     * @param {EpwNamedNumberField} field
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
 * @extends {RawPositionScaler}
 */
class RawPositionScalerOverlap extends RawPositionScaler {
    xScaler = new XModulusValueScaler(24)
}