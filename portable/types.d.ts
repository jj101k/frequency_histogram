/**
 *
 */
interface ZeroWidthPoint {
    /**
     *
     */
    readonly dataSource: number
    /**
     *
     */
    readonly y: number
    /**
     *
     */
    readonly zeroSpan: number
}

/**
 *
 */
interface DeltaDatum {
    /**
     * The period for which this value was in effect.
     */
    dF: number
    /**
     * The original value
     */
    readonly y: number
    /**
     *
     */
    readonly zeroSpan?: undefined
}

/**
 *
 */
interface DeltaInfo {
    /**
     *
     */
    deltas: DeltaDatum[]
    /**
     * These are points which have zero width, ie. the value does not change
     * between two adjacent time points. These must be sorted by y value (ascending).
     */
    zeroWidthPoints: ZeroWidthPoint[]
    /**
     *
     */
    zeroDeltaSpan: number
}

/**
 *
 */
interface InputDatum {
    /**
     *
     */
    readonly dataSource: number
    /**
     *
     */
    readonly x: number
    /**
     *
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