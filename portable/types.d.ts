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
    readonly combined: {
        /**
         *
         */
        readonly combinedDeltas: Readonly<DeltaDatum>[]
        /**
         * When a value appears twice (or more) in a row on the timeline, it
         * would appear as a zero-width, infinitely high spike on the frequency
         * map. This value defines an assumed width to use instead, essentially
         * a declaration that the actual underlying value is that +/-n/2.
         */
        readonly zeroDeltaSpan: number
    }
}