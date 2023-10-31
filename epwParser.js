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
     * @template {any} T
     * @param {EpwNamedField<T>} field
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
     * @template {number} T
     * @param {EpwNamedField<T | null>} field
     * @param {T | undefined} limit
     */
    getValues(field, limit = undefined) {
        const rows = limit === undefined ? this.rows : this.rows.slice(0, limit)
        const r = rows.map(
            (r, i) => ({x: i, y: r.get(field)})
        )

        const sampleSize = 24
        const loggableRunLength = 4
        const maxLoggableRuns = 50
        let runs = 0
        let last = r[0].y
        for(const ri of r.slice(1, sampleSize)) {
            if(ri.y != last) {
                runs++
                last = ri.y
            }
        }

        if(runs * loggableRunLength < sampleSize) {
            console.log("Dumping run lengths")
            let runs = 0
            /**
             * @type {number | null | undefined}
             */
            let l = r[0].y
            let c = 0
            for(const ri of r) {
                if(ri.y !== l) {
                    console.log(`${l}: ${c}`)
                    runs++
                    if(runs > maxLoggableRuns) {
                        console.error("Too many runs!")
                        break
                    }
                    l = ri.y
                    c = 1
                } else {
                    c++
                }
            }
            console.log(`${l}: ${c}`)
        } else {
            console.log("Raw values", r)
        }
        return r
    }


    /**
     *
     * @param {EpwNamedField<string | number | null>[]} fields
     * @param {number | undefined} limit
     */
    getValueMulti(fields, limit = undefined) {
        const rows = limit === undefined ? this.rows : this.rows.slice(0, limit)
        return rows.map((r) => fields.map(f => r.get(f)))
    }
}