/**
 *
 */
class EpwNumberField {
    /**
     * s
     */
    #offset
    /**
     *
     */
    #min
    /**
     *
     */
    #max
    /**
     *
     */
    #missing
    /**
     *
     * @param {number} offset
     * @param {number} min
     * @param {number} max
     * @param {number} missing
     */
    constructor(offset, min, max, missing) {
        this.#offset = offset
        this.#min = min
        this.#max = max
        this.#missing = missing
    }
    /**
     *
     * @param {string[]} lineParts
     */
    parse(lineParts) {
        const c = lineParts[this.#offset]
        const v = +c
        if(Number.isNaN(v)) {
            throw new Error(`NaN on offset ${this.#offset}: ${c}`)
        }
        if(v == this.#missing) {
            return null
        }
        if(v < this.#min) {
            throw new Error(`Out-of-range: ${v} < ${this.#min}`)
        }
        if(v > this.#max) {
            throw new Error(`Out-of-range: ${v} > ${this.#max}`)
        }
        return v
    }
}

/**
 *
 */
const NumberFields = {
    dryBulb: new EpwNumberField(6, -70, 70, 99.9),
    dewPoint: new EpwNumberField(7, -70, 70, 99.9),
}

/**
 *
 */
class EpwRow {
    /**
     *
     */
    #line

    /**
     *
     */
    get #lineParts() {
        return this.#line.split(/,/)
    }

    /**
     *
     * @param {string} line
     */
    constructor(line) {
        this.#line = line
    }

    /**
     *
     * @param {keyof NumberFields} field
     */
    get(field) {
        return NumberFields[field].parse(this.#lineParts)
    }
}

/**
 *
 */
class EpwParser {
    /**
     *
     */
    #content

    /**
     *
     */
    get rows() {
        const trimmedResult = this.#content.split(/\nDATA PERIODS,.*\r\n/)[1]
        return trimmedResult.replace(/\r?\n$/, "").split(/\r?\n/).map(
            c => new EpwRow(c)
        ) // .slice(0, 96)
    }
    /**
     *
     * @param {string} content
     */
    constructor(content) {
        this.#content = content
    }

    /**
     *
     * @param {keyof NumberFields} field
     */
    getValues(field) {
        const r = this.rows.map(
            (r, i) => ({x: i, y: r.get(field)})
        ) // .slice(0, 96)
        console.log(r)
        return r
    }
}