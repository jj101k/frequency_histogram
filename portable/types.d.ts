/**
 *
 */
interface DeltaInfo {
    /**
     *
     */
    deltas: {y: number, dF: number, zeroSpan?: undefined}[]
    /**
     *
     */
    zeroWidthPoints: {y: number, zeroSpan: number, dataSource: number}[]
    /**
     *
     */
    zeroDeltaSpan: number
}

/**
 *
 */
type numberOptions = {units?: string, minimum?: number, maximum?: number, enumerated?: number[]} & ({missing: number} | {missingGreaterEqual: number})

/**
 *
 */
type HistogramDatum = {f: number, y: number}

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
        readonly combinedDeltas: {
            /**
             * The original value
             */
            readonly y: number
            /**
             * The period for which this value was in effect.
             */
            readonly dF: number
        }[]
        /**
         * When a value appears twice (or more) in a row on the timeline, it
         * would appear as a zero-width, infinitely high spike on the frequency
         * map. This value defines an assumed width to use instead, essentially
         * a declaration that the actual underlying value is that +/-n/2.
         */
        readonly zeroDeltaSpan: number
    }
}