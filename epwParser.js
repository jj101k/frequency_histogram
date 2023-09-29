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
     */
    get dryBulb() {
        const t = +this.#lineParts[6]
        if(Number.isNaN(t)) {
            throw new Error(`NaN on: ${c}`)
        }
        return t
    }
    /**
     *
     * @param {string} line
     */
    constructor(line) {
        this.#line = line
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
    get dryBulbValues() {
        const r = this.rows.map(
            (r, i) => ({x: i, y: r.dryBulb})
        ) // .slice(0, 96)
        console.log(r)
        return r
    }

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
}