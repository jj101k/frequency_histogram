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
type numberOptions = {units?: string, minimum?: number, maximum?: number} & ({missing: number} | {missingGreaterEqual: number})