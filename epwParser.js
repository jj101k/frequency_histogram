/// <reference path="epwDataFormat.js" />

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
    get dataSourceRef() {
        return this.#lineParts.slice(0, 2).join("-")
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
     * @param {((value: EpwRow) => boolean) | undefined} filter
     * @returns
     */
    getValues(field, limit = undefined, filter = undefined) {
        /**
         * @type {EpwRow[]}
         */
        let rows
        if(limit === undefined) {
            if(filter === undefined) {
                rows = this.rows
            } else {
                rows = this.rows.filter(filter)
            }
        } else {
            if(filter === undefined) {
                rows = this.rows.slice(0, limit)
            } else {
                rows = []
                let added = 0
                for(const row of this.rows) {
                    if(filter(row)) {
                        rows.push(row)
                        added++
                        if(added >= limit) {
                            break
                        }
                    }
                }
            }
        }

        /**
         * @type {Map<string, number>}
         */
        const dataSourceRefs = new Map()
        let nextDataSourceRef = 1
        /**
         *
         * @param {EpwRow} r
         */
        const uniqueDataSource = (r) => {
            const ref = r.dataSourceRef
            const u = dataSourceRefs.get(ref)
            if(u !== undefined) {
                return u
            }
            dataSourceRefs.set(ref, nextDataSourceRef)
            return nextDataSourceRef++
        }

        const r = rows.map(
            (r, i) => ({x: i, y: r.get(field), dataSource: uniqueDataSource(r)})
        )

        const sampleSize = 24
        const loggableRunLength = 4
        const maxLoggableRuns = 50
        let runs = 0
        let last = r[0]?.y
        for(const ri of r.slice(1, sampleSize)) {
            if(ri.y != last) {
                runs++
                last = ri.y
            }
        }

        if(runs * loggableRunLength < sampleSize) {
            console.log("Dumping run lengths")
            /**
             * @type {Record<number,number>}
             */
            let runLengths = {}
            let runs = 0
            /**
             * @type {number | null | undefined}
             */
            let l = r[0]?.y
            let c = 0
            for(const ri of r) {
                if(ri.y !== l) {
                    if(l !== null && l !== undefined) {
                        runLengths[l] = c
                    }
                    runs++
                    if(runs > maxLoggableRuns) {
                        console.warn(`Too many runs to dump fully, will just dump the first ${maxLoggableRuns}`)
                        break
                    }
                    l = ri.y
                    c = 1
                } else {
                    c++
                }
            }
            if(l !== null && l !== undefined) {
                runLengths[l] = c
            }
            console.log(runLengths)
        } else {
            console.log("Raw values", r)
        }
        console.log(`${r.length} raw values`)
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