/**
 * A run of a single value for a continuous period, eg. where you have v=1,t=0
 * followed by v=1,t=1.
 */
interface ZeroWidthPoint {
    /**
     *
     */
    readonly dataSource: number
    /**
     * The value which was continuously found
     */
    readonly y: number
    /**
     * How wide a span of time (or equivalent) this value was continuously found
     * for. Initially, this will be t[end]-t[start] (typically 1, but can be
     * more for a run of identical values); when collating, this may be the sum
     * of several such runs.
     */
    readonly zeroSpan: number
}

/**
 * A change in popularity at a particular value.
 *
 * These values are typically paired, eg. a value of {x: 0, y: 5},
 * {x: 3, y: 7} will produce {y: 5, dF: 3}, {y: 7, dF: -3}. Identical values
 * may be combined, so {x: 0, y: 5}, {x: 3, y: 7}, {x: 4, y: 6} could produce
 * ({y: 5, dF: 3}, {y: 7, dF: -3}), ({y: 7, dF: 1}, {y: 6, dF: -1}) or equivalently
 * {y: 5, dF: 3}, {y: 6, dF: -1}, {y: 7, dF: -2}.
 */
interface DeltaDatum {
    /**
     * How much the popularity changes at this point. Generally an integer.
     *
     * You can think of this as how much the value steps up or down from the
     * previous point.
     */
    dF: number
    /**
     * The value at which this change occurs
     */
    readonly y: number
    /**
     * N/A here
     *
     * @see ZeroWidthPoint
     */
    readonly zeroSpan?: undefined
}

/**
 * The entire data set to be considered.
 */
interface DeltaInfo {
    /**
     * Point pairs which span a range of values and therefore have simple
     * popularity values.
     */
    readonly deltas: ReadonlyArray<DeltaDatum>
    /**
     * How much difference there is between adjacent values
     */
    readonly precision: number
    /**
     * These are points which have zero width, ie. the value does not change
     * between two adjacent time points. These must be sorted by y value (ascending).
     */
    readonly zeroWidthPoints: ReadonlyArray<ZeroWidthPoint>
}

/**
 * The data as it's originally expressed, ie plain 'y' values across time-like
 * scale 'x'.
 */
interface InputDatum {
    /**
     * Identification of the underlying data source. This is used for noise reduction.
     */
    readonly dataSource: number
    /**
     * The comparison scale value. Typically, this is time.
     */
    readonly x: number
    /**
     * The data value
     */
    readonly y: number
}

/**
 *
 */
type numberOptions = {units?: string, minimum?: number, maximum?: number, enumerated?: number[]} & ({missing: number} | {missingGreaterEqual: number})

/**
 *
 */
type valueConfiguration = {exponentialValues?: boolean, expectsExponentialFrequency?: boolean}

/**
 *
 */
interface HistogramDeltasAny {
    /**
     * This provides the deltas with all values with the same y value combined.
     */
    readonly combined: Readonly<DeltaDatum>[]
}