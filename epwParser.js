//@ts-check

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
     * @param {EpwNamedField} field
     */
    get(field) {
        return field.parse(this.#lineParts)
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
     * @param {EpwNamedField} field
     */
    getValues(field) {
        const r = this.rows.map(
            (r, i) => ({x: i, y: r.get(field)})
        ) // .slice(0, 96)
        console.log(r)
        return r
    }
}